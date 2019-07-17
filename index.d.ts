/* NB: This is not a complete declaration for the ApiPublisher module */

import { ClientRequestArgs, IncomingMessage, OutgoingMessage } from 'http';
import { AfnLoader, MemoAsyncFunction, MemoConfig } from 'afn';

interface HttpRequestHandler {
  (req: IncomingMessage, res: OutgoingMessage, next: (err?: any) => void): any;
}

// A RemotableAsyncFunction as an async function that has optional `ttl` and `clientInstance` properties
interface RemotableAsyncFunction<Return, Args extends any[]> extends MemoAsyncFunction<Return, Args> {
  ttl?: {
    server?: number | MemoConfig<Return, Args>['TTL'],
    serverKey?: MemoConfig<Return, Args>['key'],
    mru?: MemoConfig<Return, Args>['MRU'],
    memoize?: boolean
  },
  clientInstance?: Args  // The args used to invoke the call at load time
}

// An AsyncApi is an object containing RemotableAsyncFunctions (async functions)
interface AsyncApi {
  [key: string]: RemotableAsyncFunction<any, any[]>;
}

export const sendRemoteApi: HttpRequestHandler;
export const remoteApiPath: string;

export class ApiPublisher {
  constructor(api: AsyncApi, options?: Parameters<AfnLoader>[0]);
  handle: HttpRequestHandler;
  /* TBC
  cacheObject(obj: any, ...args: any[]): any;
  callRemoteApi(name: any, req: any, rsp: any, next: any): any;
  getRemoteApi(req: any, path: any, ok: any): any;
  handle(req: any, rsp: any, next: any): any;
  proxyContext(name: any, req: any, rsp: any, args: any, ...args: any[]): any;
  sendRemoteApi(req: any, rsp: any): void;
  sendReturn(req: any, rsp: any, result: any, status: any): void;
  serializer(req: any, rsp: any): any;
  warn(...args: any[]): void;
  */
}

type PromiseConstructor = new <T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) => Promise<T>;

export class ServerApi {
  static load<T>(url: string, promiseConstructor?: PromiseConstructor): Promise<T & ServerApi>;
  constructor(url: string, onLoad?: (theApi: ServerApi) => void, promiseConstructor?: PromiseConstructor);
  setHttpOptions(request: ClientRequestArgs): void;
  /* TBC
  onSuccess(result:unknown):unknown;
  onError(error:unknown):unknown;
  headers: { [key: string]: string };
  serializer(this: any, key: string, value: any): any;
  reviver(this: any, key: string, value: any): any;
  */
}


