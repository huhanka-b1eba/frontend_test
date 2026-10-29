import type { ApiClientConfig, ApiRequestOptions } from './types';
import { logRouteApiError, logRouteApiResponse, startRouteApiDebug } from './routeDebug';

const DEFAULT_API_CONFIG: ApiClientConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
};

export class ApiClient {
  constructor(private readonly config: ApiClientConfig = DEFAULT_API_CONFIG) {}

  async request<TResponse>(endpoint: string, options: ApiRequestOptions = {}) {
    const headers = new Headers(options.headers);
    const { routeApiAction, ...fetchOptions } = options;

    headers.set('Accept', 'application/json');

    if (
      fetchOptions.body !== undefined &&
      fetchOptions.body !== null &&
      !(fetchOptions.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const method = fetchOptions.method ?? 'GET';
    const routeDebugInfo = startRouteApiDebug({
      action: routeApiAction,
      method,
      url,
      body: fetchOptions.body,
    });

    let response: Response;

    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } catch (error) {
      logRouteApiError({ info: routeDebugInfo, error });
      throw error;
    }

    await logRouteApiResponse(routeDebugInfo, response);

    if (!response.ok) {
      const apiError = await ApiError.fromResponse(response);

      logRouteApiError({ info: routeDebugInfo, error: apiError, status: response.status });
      throw apiError;
    }

    if (response.status === 204) {
      return null as TResponse;
    }

    try {
      return (await response.json()) as TResponse;
    } catch {
      throw new ApiError({
        message: 'Некорректный ответ сервера',
        status: response.status,
      });
    }
  }

  async requestBlob(endpoint: string, options: ApiRequestOptions = {}) {
    const headers = new Headers(options.headers);
    const { routeApiAction, ...fetchOptions } = options;

    if (!headers.has('Accept')) {
      headers.set('Accept', 'audio/wav');
    }

    if (
      fetchOptions.body !== undefined &&
      fetchOptions.body !== null &&
      !(fetchOptions.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const method = fetchOptions.method ?? 'GET';
    const routeDebugInfo = startRouteApiDebug({
      action: routeApiAction,
      method,
      url,
      body: fetchOptions.body,
    });

    let response: Response;

    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } catch (error) {
      logRouteApiError({ info: routeDebugInfo, error });
      throw error;
    }

    await logRouteApiResponse(routeDebugInfo, response);

    if (!response.ok) {
      const apiError = await ApiError.fromResponse(response);

      logRouteApiError({ info: routeDebugInfo, error: apiError, status: response.status });
      throw apiError;
    }

    return response.blob();
  }
}

type ApiErrorParams = {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
  retryAfterSeconds?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeErrors = (value: unknown): Record<string, string[]> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const errors: Record<string, string[]> = {};

  Object.entries(value).forEach(([key, item]) => {
    if (Array.isArray(item)) {
      errors[key] = item.filter((message): message is string => typeof message === 'string');
    }
  });

  return Object.keys(errors).length > 0 ? errors : undefined;
};

export class ApiError extends Error {
  readonly status?: number;
  readonly errors?: Record<string, string[]>;
  readonly retryAfterSeconds?: number;

  constructor({ message, status, errors, retryAfterSeconds }: ApiErrorParams) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static async fromResponse(response: Response) {
    const retryAfter = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
    const fallbackMessage = `API request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as unknown;

      if (isRecord(payload)) {
        const message =
          typeof payload.message === 'string'
            ? payload.message
            : typeof payload.title === 'string'
              ? payload.title
              : fallbackMessage;

        return new ApiError({
          message,
          status: response.status,
          errors: normalizeErrors(payload.errors),
          retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        });
      }
    } catch {
      // Fall through to the generic error below.
    }

    return new ApiError({
      message: fallbackMessage,
      status: response.status,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    });
  }
}

export const apiClient = new ApiClient();
