/* NB: This is not a complete declaration for the ApiPublisher module */

import { ClientRequestArgs, IncomingMessage, OutgoingMessage, ServerResponse } from 'http';
import { AfnLoader, MemoAsyncFunction, MemoConfig } from 'afn';

export interface HttpRequestHandler {
  (req: IncomingMessage, res: OutgoingMessage, next: (err?: any) => void): any;
}

// A RemotableAsyncFunction as an async function that has optional `ttl` and `clientInstance` properties
interface RemotableAsyncFunction<Return, Args extends any[]> extends MemoAsyncFunction<Return, Args> {
  ttl?: {
    on?: string;
    t?: number;
    server?: number | MemoConfig<Return, Args>['TTL'],
    serverKey?: MemoConfig<Return, Args>['key'],
    mru?: MemoConfig<Return, Args>['MRU'],
    memoize?: boolean
  },
  clientInstance?: Args  // The args used to invoke the call at load time
}

// An AsyncApi is an object containing RemotableAsyncFunctions (async functions)
export interface AsyncApi {
  [key: string]: RemotableAsyncFunction<any, any[]>;
}

// A RemotedApiContext is the `this` passed to an AsyncApi member when it is called remotely
// Specifically it will have a `request` and AlreadyHandled properties. Throwing `AlreadyHandled`
// will prevent the ApiPublisher from generating any response (ie the function should do it iself)
export type RemotedApiContext<AsyncApi = {}> = { AlreadyHandled?: Error, request?: { res: ServerResponse } & IncomingMessage } & AsyncApi;

export const sendRemoteApi: HttpRequestHandler;
export const remoteApiPath: string;

export class ApiPublisher<ThsiApi extends AsyncApi = {}> {
  constructor(api: ThsiApi, options?: Parameters<AfnLoader>[0]);

  handle: HttpRequestHandler;

  proxyContext<Req extends IncomingMessage, Res extends ServerResponse, Name extends keyof ThsiApi>(
    name: Name | null,
    req: Req,
    rsp: Res,
    args: Parameters<ThsiApi[Name]> | null
  ): RemotedApiContext<ThsiApi> | Promise<RemotedApiContext<ThsiApi>>;

  serializer(req: IncomingMessage, rsp: ServerResponse): Parameters<typeof JSON.stringify>[1];
  sendReturn(req: IncomingMessage, rsp: ServerResponse, result: any, status: number, context: RemotedApiContext<ThsiApi>, promise: { origin: string[]}): void;
  /* TBC
    cacheObject(obj: any, ...args: any[]): any;
    callRemoteApi(name: any, req: any, rsp: any, next: any): any;
    getRemoteApi(req: any, path: any, ok: any): any;
    sendRemoteApi(req: any, rsp: any): void;
    warn(...args: any[]): void;
  */
}

type PromiseConstructor = new <T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) => Promise<T>;

export class ServerApi {
  static load<T>(url: string, promiseConstructor?: PromiseConstructor): Promise<T & ServerApi>;
  constructor(url: string, onLoad?: (theApi: ServerApi) => void, promiseConstructor?: PromiseConstructor);
  setHttpOptions(request: ClientRequestArgs): void;
  headers?: { [key: string]: string };
  /* TBC
    onSuccess(result:unknown):unknown;
    onError(error:unknown):unknown;
    serializer(this: any, key: string, value: any): any;
    reviver(this: any, key: string, value: any): any;
  */
}

// The types exposed when the script "RemoteApi.js" is included in a client
export * from './www';