/// <reference lib="dom" />

// The constant exposed when the script "RemoteApi.js" is included in a client
export interface ApiError extends Error {
  httpResponse?: {
    status: number;
    response: string;
  };
  cause?: {
    path: string,
    name: string,
    args: any[]
  };
  networkError?: boolean;
}

export interface RemoteApiOptions<T extends RemotedApi = {}> {
  onSuccess(result: any): void;
  onError(error: Error): void;
  apiStart<K extends keyof T>(path: string, name: K, args: Parameters<T[K]>, xhr: XMLHttpRequest): void;
  apiEnd<K extends keyof T>(path: string, name: K, args: Parameters<T[K]>, error: boolean, result: any | Error): void;
  clearCache(): void;
  log(...a: any[]): void;

  method: 'POST' | 'GET';
  version: "" | `${number}`;
  reviver: (this: any, key: string, value: any) => any; // Parameters<typeof JSON['parse']>[1];
  serializer: (this: any, key: string, value: any) => any; // Parameters<JSON['stringify']>[1];
  headers: { [header: string]: string };
  /* TBC
    static RemoteApi.StorageCache: function(storage)
    static RemoteApi.ObjectCache: function ObjectCache(name)
    static Cache
*/
}

export interface RemotedApi { [fn: string]: (...a: any[]) => Promise<any> }

export interface RemoteApi extends RemoteApiOptions {
  load<T extends RemotedApi>(endpoint: string, overrides?: Partial<RemoteApiOptions>): Promise<T & RemoteApiOptions<T>>;
  ApiError: ApiError;
}