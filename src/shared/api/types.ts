export type ApiClientConfig = {
  baseUrl: string;
};

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null;
  routeApiAction?: 'CREATE' | 'REBUILD';
};
