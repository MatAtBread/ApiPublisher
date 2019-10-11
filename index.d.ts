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

// A RemotedApiContext is the `this` passed to an AsyncApi member when it is called remotely
// Specifically it will have a `request` and AlreadyHandled properties. Throwing `AlreadyHandled`
// will prevent the ApiPublisher from generating any response (ie the function should do it iself)
export type RemotedApiContext<AsyncApi = {}> = { AlreadyHandled?: Error, request?: { res: ServerResponse } & ClientRequest } & AsyncApi | undefined;

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

// The constant exposed when the script "RemoteApi.js" is included in a client
export interface ApiError extends Error {
  httpResponse?:{
    status:number;
    response:Text;
  };
  cause?: {
    path:string,
    name:string,
    args:any[]
  };
  networkError?:boolean;
};

export class RemoteApi {
  static load<T extends {}>(endpoint: string): Promise<T>;
  static ApiError:ApiError;
  /* TBC
    static RemoteApi.StorageCache: function(storage)
    static RemoteApi.ObjectCache: function ObjectCache(name)

    onSuccess:function(result)
    onError:function(xhr)
    apiStart:function(path,name,args,xhr)
    apiEnd:function(path,name,args,error,data)
    version:"",
    reviver:null,
    serializer:null,
    headers:null,
    log:function() {},
    Cache:RemoteApi.ObjectCache,
    clearCache:function()
 */
}
