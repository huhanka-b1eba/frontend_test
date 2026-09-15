import type { ApiClientConfig, ApiRequestOptions } from './types';

const DEFAULT_API_CONFIG: ApiClientConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
};

export class ApiClient {
  constructor(private readonly config: ApiClientConfig = DEFAULT_API_CONFIG) {}

  async request<TResponse>(endpoint: string, options: ApiRequestOptions = {}) {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return response.json() as Promise<TResponse>;
  }
}

export const apiClient = new ApiClient();
