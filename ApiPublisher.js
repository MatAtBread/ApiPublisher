/**
 * ApiPublisher
 * Make server-side JS functions callable from remote clients
 * - only supports static calls (no guarantees about "this" or "new")
 * - only supports async callbacks in the Promise style
 * 	 i.e. those that have the form func(args...).then(okCallback,errorCallback)
 */

var nodent = require('nodent')({dontInstallRequireHook:true}) ;
var map = nodent.require('map') ;
var Thenable = global.Promise || nodent.EagerThenable() ;
var URL = require('url');

const parametersRegex = /\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)|\w+(?=\s*=>)/;

/**
 * Create an object representing functions that can be called remotely
 *  
 * @param obj	- the object containing the functions to make available remotely
 */
function ApiPublisher(obj,options) {
    options = options || {} ;
    if (!options.memo)
        options.memo = {};

    var afn = require('afn')(options);
    var that = this ;
    that.api = {} ;
    that.names = {} ;
    that.nested = {} ;
    that.context = obj ;

    for (var i in obj) if (obj.hasOwnProperty(i)){
        if (typeof obj[i] == 'function') {
            var fn = obj[i] ;
            that.names[i] = { parameters: fn.length } ; // Remote call info 
            if (fn.ttl && !fn.clientInstance) {
                that.names[i].ttl = fn.ttl ; // Remote call info
                const usableOpts = {
                    ttl: typeof fn.ttl.server==="number" ? fn.ttl.server*1000:fn.ttl.server
                };
                if (fn.ttl.serverKey !== undefined)
                    usableOpts.key = fn.ttl.serverKey;
                if (fn.ttl.mru !== undefined) {
                    usableOpts.mru = fn.ttl.mru;
                }
                fn = afn.memo(fn, usableOpts) ;
                fn.ttl = that.names[i].ttl ;
                if (fn.ttl.memoize)
                    obj[i] = fn ;
            }
            
            that.api[i] = {fn:fn} ;
			try {
                var m = fn.toString().match(parametersRegex);
                if (m && m[0])
                    that.names[i].parameters = m[0] ;
			} catch (ex) {
				// Unknown number of parameters
			}
        }
    }

    that.handle = ApiPublisher.prototype.handle.bind(this) ;
    return that ;
}

ApiPublisher.prototype.warn = function() {
    console.warn.apply(console,['ApiPublisher:'].concat(arguments));
}

/**
 * Return an object whose keys represent the remotely callable 
 * functions found when constructing the class. These will be 
 * remoted so they can be called from the client asynchronously
 * via a POST containing the arguments.
 * 
 * Any (async) functions marked ".clientInstance" are evaluated once and the
 * result is wrapped by RemoteApi to look like an RPC, but actually returned
 * locally. If an clientInstance function returns an ApiPublisher, it too is unwound
 * and marshalled so it can be called remotely, allowing for conditional, 
 * nested, remote APIs 
 *  
 * @param req
 * @param ok
 */
ApiPublisher.prototype.getRemoteApi = function(req,path,ok,error) {
    var self = this ;
    if (path)
        self.path = path ;
    map(self.api, function(e){
        return new Thenable(function(ok,error) {
            var fn = self.api[e].fn ;
            if (fn[req.apiVersion])
                fn = fn[req.apiVersion] ;
            if (fn.clientInstance) {
                if (fn.length != fn.clientInstance.length)
                    self.warn("Remote instance function arguments not the same as declaration:",e) ;

                return fn.apply(self.proxyContext(null,req,null,null),fn.clientInstance).then(function(instanceData){
                    if (instanceData instanceof ApiPublisher) {
                        self.nested[e] = instanceData ;
                        instanceData.getRemoteApi(req, e, 
                            function(api){
                                api._isRemoteApi = true ;
                                ok(api) ;
                            },error) ;
                    } else {
                        ok(instanceData) ;
                    }
                },error) ;
            } else {
                ok(self.names[e]) ;
            }
        });
    }).then(ok,error || $error) ;
};

var stdHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Expires': 'Fri, 01 Jan 1990 00:00:00 GMT',
    'pragma': 'no-cache'
} ;

ApiPublisher.prototype.sendRemoteApi = function(req,rsp) {
    var that = this ;
    this.getRemoteApi(req,null,
        function(instance) {
            rsp.writeHead(200, stdHeaders);
            rsp.end(JSON.stringify(instance,that.serializer(req,rsp)));
        }, function(error){
            rsp.writeHead(500, stdHeaders);
            rsp.end(JSON.stringify(error/*,that.serializer(req,rsp)*/));
        }
    ) ;
};

/**
 * Remote invocation of a local async funcback API. 
 **/
ApiPublisher.prototype.sendReturn = function(req,rsp,result,status) {
    var json = JSON.stringify(result,this.serializer(req,rsp)) ;
    rsp.end(json);
}

ApiPublisher.prototype.callRemoteApi = function(name,req,rsp,next) {
    var args = name.split(/\?(.*)/) ;
    var that = this ;

    name = args[0] ;
    if (!this.api[name]) {
    		return next() ;
    }

    // Because we like to accept nicely posted JSON, _and_ form input data, we 
    // test the body type
    if (req.method=="POST")
        args = req.body; 
    else if (req.method=="GET") {
        if (args[1]) {
            try {
                args = JSON.parse(decodeURIComponent(args[1])) ;
            } catch (ex) {
                return errorCB(new Error("Incorrect parameter format "+req.method+" "+ex.message),500) ;
            }
        } else args = [] ;
    } else {
        return errorCB(new Error("Method not allowed: "+req.method),405) ;
    }

    if (!Array.isArray(args))
        args = [args] ; // Wasn't a JSON encoded argument list, so wrap it like it was

    var fn = this.api[name].fn ;
    if (fn[req.apiVersion])
        fn = fn[req.apiVersion] ; 

    // Proto-augment "this" with the current request so the remoted API can query session
    // info etc.
    var promise, context = this.proxyContext(name,req,rsp,args) ;
    if (nodent.isThenable(context)) {
        context.then(function(c){
            context = c ;
            withContext();
        },errorCB)
    } else {
        withContext();
    }

    /* Send the response to the client */
    function sendReturn(result){
        var headers = stdHeaders ;
        if (!rsp.headersSent) {
            if (promise && promise.origin) {
                rsp.setHeader("X-Cache-Origin",JSON.stringify(promise.origin.map(src => encodeURIComponent(src)))) ;
                if (promise.origin.expires) {
                    headers = {
                        'Content-Type': stdHeaders['Content-Type'],
                        'Expires': new Date(promise.origin.expires).toUTCString()
                    } ;
                }
            }

            for (var i in headers)
                rsp.setHeader(i,headers[i]) ;
            
            rsp.statusCode = result.status || 200 ;
            that.sendReturn(req,rsp,result.value,result.status,context,promise) ;
        }
    } ;

    /* Send a successful result, updating the cache if required */
    function returnCB(t,status) {
        if (nodent.isThenable(t)) {
            return t.then(returnCB,errorCB) ;
        }

        var result = {value:t,status:status} ;
        if (!status || status==200) { 
            if (t instanceof ApiPublisher) {
                t.sendRemoteApi(req,rsp) ;
                return ;
            }
        }
        sendReturn(result);
    };

    /* Send an error result, invalidating the cache */
    function errorCB(err,status) {
        if (context && err === context.AlreadyHandled)
            return ;
    
        if (err && err.httpStatus)
            status = err.httpStatus;
        if (!(err instanceof Error))
            err = new Error(err ? (err.message || err.toString()) : "Error") ;

        var result = {value:{error:err.message,cause:err.stack} ,status:status || 500} ;

        sendReturn(result);
    } ;

    function withContext() {
        if (!('AlreadyHandled' in context)) {
            Object.defineProperty(context,"AlreadyHandled",{value:{}}) ;
        }

        try {
            (promise = fn.apply(context,args)).then(returnCB,errorCB) ;
        } catch (ex) {
            errorCB(ex);
        }
    }
};

// Deprecated - this is no longer called internally
ApiPublisher.prototype.cacheObject = function(obj) {
    return {args:obj.arguments,version:obj.request.apiVersion} ;
};

ApiPublisher.prototype.proxyContext = function(name,req,rsp,args) {
    return Object.create(this.context,{ request:{value:req}, arguments:{value:args} }) ;
};

ApiPublisher.prototype.serializer = function(req,rsp) {
    return null ;
};

/**
 * Handle an Api request
 *
 * Any empty URL ("/" or "") means return the current API definition
 * A name URI means call that function, e.eg /getInfo
 * Any API can be followed by a number indicating the version, e.g.
 * "/2" get version 2 of the API definition
 * "/getInfo/2" call version 2 of the getInfo() function
 */

ApiPublisher.prototype.handle = function(req,rsp,next) {
    var url = URL.parse(req.url.toString()) ;
    var path = url.pathname.split("/") ;
    if (path[path.length-1]=="")
        path.pop(); // Strip any trailing "/"
    req.apiVersion = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
    if (req.apiVersion>0)
        path.pop() ; // Strip the version number
    if (path.length<2 || path[1]=="") {
        this.sendRemoteApi(req,rsp) ;
    } else {
        var self = this ;
        path.shift() ;
        var call = decodeURIComponent(path.pop()) ;
        if (url.query && req.method === "GET")
          call = call+"?"+url.query;

        (function walkPath() {
            if (path.length===0)
                return self.callRemoteApi(call,req,rsp,next) ;	// Client is making a remote call

            var e = path.shift() ;
            var subApi = self.nested[e] ;
            if (subApi)
                return subApi.callRemoteApi(call,req,rsp,next) ;

            if (self.api[e] &&
                self.api[e].fn &&
                self.api[e].fn.clientInstance && 
                self.api[e].fn.clientInstance.length===0) {

                return self.api[e].fn.apply(self.proxyContext(null,req,rsp,null)).then(function(instanceData){
                    if (instanceData instanceof ApiPublisher) {
                        self.nested[e] = instanceData ;
                        path.unshift(e) ;
                        return walkPath() ;
                    } 
                    return next() ;
                },next) ;
            }
            return next(/* Could not find/load nested API*/) ;
        })() ;
    }
} ;

module.exports = ApiPublisher;
