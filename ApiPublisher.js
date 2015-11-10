/**
 * ApiPublisher
 * Make server-side JS functions callable from remote clients
 * - only supports static calls (no guarantees about "this" or "new")
 * - only supports async callbacks in the Promise style
 * 	 i.e. those that have the form func(args...).then(okCallback,errorCallback)
 */

var nodent = require('nodent')({dontInstallRequireHook:true}) ;
var map = nodent.require('map') ;
var DEBUG = global.DEBUG || (process.env.DEV ? function(){ console.log.apply(this,arguments); }:function(){}) ;

/**
 * Create an object representing functions that can be called remotely
 *  
 * @param obj	- the object containing the functions to make available remotely
 */
function ApiPublisher(obj) {
	var that = this ;
	that.api = {} ;
	that.names = {} ;
	that.cache = {} ;
	that.nested = {} ;
	that.context = obj ;

	for (var i in obj) if (obj.hasOwnProperty(i)){
		if (typeof obj[i] == 'function') {
			that.api[i] = {fn:obj[i]} ;
			that.names[i] = { parameters: obj[i].length } ; // Remote call info 
			try {
				that.names[i].parameters = obj[i].toString().match(/[^(]*(\(.*\))/)[1] ;
			} catch (ex) {
				DEBUG(40,ex) ;
			}
			
			if (obj[i].ttl)
				that.names[i].ttl = obj[i].ttl ; // Remote call info 
		}
	}
	
	setInterval(function(){
		var now = Date.now() ;
		Object.keys(that.cache).forEach(function(k){
			var j = Object.keys(that.cache[k]) ;
			if (j && !j.length)
				delete that.cache[k] ;
			else j.forEach(function(e){
				if (that.cache[k][j].expires < now)
					delete that.cache[k][j] ;
			}) ;
		}) ;
	},65536) ;
	
	that.handle = ApiPublisher.prototype.handle.bind(this) ;
	return that ;
//	var boundHandler = that.handle.bind(that) ;
//	boundHandler.prototype = that ; 	// So that users can say 'api.prototype.Xxx = ()'
//	return boundHandler ;
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
ApiPublisher.prototype.getRemoteApi = function(req,path,ok) {
	var self = this ;
	if (path)
		self.path = path ;
	map(self.api, function(e){
		return new nodent.Thenable(function(ok,error) {
			var fn = self.api[e].fn ;
			if (fn[req.apiVersion])
				fn = fn[req.apiVersion] ;
			if (fn.clientInstance) {
				if (fn.length != fn.clientInstance.length) {
					DEBUG(20,"Warning: Remote instance function arguments not the same as declaration:",e) ;
				}
				return fn.apply({request:req},fn.clientInstance).then(function(instanceData){
					if (instanceData instanceof ApiPublisher) {
						 self.nested[e] = instanceData ;
						 instanceData.getRemoteApi(req, e, function(api){
							 api._isRemoteApi = true ;
							 ok(api) ;
						 }) ;
					} else {
						ok(instanceData) ;
					}
				},error) ;
			} else {
				ok(self.names[e]) ;
			}
		});
	}).then(ok,$error) ;
};

var stdHeaders = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
		'Expires': 'Fri, 01 Jan 1990 00:00:00 GMT',
		'pragma': 'no-cache'
} ;

ApiPublisher.prototype.sendRemoteApi = function(req,rsp) {
	var that = this ;
	this.getRemoteApi(req,null,function(instance){
//		instance._remotePath = req.originalUrl ;
		rsp.writeHead(200, stdHeaders);
		rsp.end(JSON.stringify(instance,that.serializer(req,rsp)));
	}) ;
};

function hash(o) {
	if (o===undefined) return "undefined" ;
	if (o===null) return "null" ;
	if (typeof o==="object"){
		var h = "";
		Object.keys(o).forEach(function(k) { h += hash(o[k])}) ;
		return hash(h) ;
	} else {
		var h = 0;
		var s = o.toString() ;
        for (var i=0; i<s.length; i++)
            h = (((h << 5) - h) + s.charCodeAt(i)) & 0xFFFFFFFF;
        return h.toString(36) ;
	}
}

/**
 * Remote invocation of a local async funcback API. 
 **/
ApiPublisher.prototype.sendReturn = function(req,rsp,result,status) {
	var json = JSON.stringify(result,this.serializer(req,rsp)) ;
	rsp.end(json);
}

ApiPublisher.prototype.callRemoteApi = function(name,req,rsp) {
	var args,that = this ;

	args = name.split("?") ;
	name = args[0] ;
	if (!that.api[name]) {
		return errorCB(new Error("Endpoint not found: "+name),404) ;
	}
	
	// Because we like to accept nicely posted JSON, _and_ form input data, we 
	// test the body type
	if (req.method=="POST")
		args = req.body; 
	else if (req.method=="GET") {
		if (args[1]) {
			args = JSON.parse(decodeURIComponent(args[1])) ;
		} else args = [] ;
	} else
		return errorCB(new Error("Method not allowed: "+req.method),405) ;
	
	if (!Array.isArray(args))
		args = [args] ; // Wasn't a JSON encoded argument list, so wrap it like it was

	var tStart = Date.now() ;
	function sendReturn(result){
		if (rsp.headersSent) {
			DEBUG(99,"Response already sent",name,args,result) ;
		} else {
			for (var i in stdHeaders)
				rsp.setHeader(i,stdHeaders[i]) ;
			rsp.statusCode = result.status || 200 ;
			if (result.status>=500) {
				DEBUG(28,"5xx Response: ",req.session) ;
			}
			DEBUG(1,name,args," "+(Date.now()-tStart)+"ms") ;
			that.sendReturn(req,rsp,result.value,result.status) ;
			DEBUG(1,name,args," sent "+(Date.now()-tStart)+"ms") ;
		}
	} ;
	
	var cache = null, key = null ;
	// Proto-augment "this" with the current request so the remoted API can query session
	// info etc.
	var context = that.proxyContext(name,req,rsp,args) ;

	// Is this result cachable on the server?
	if (that.names[name].ttl && that.names[name].ttl.server) {
		key = hash(that.cacheObject(context)) ;
		if (key) {
			that.cache[name] = that.cache[name] || {} ;
			cache = that.cache[name] ;
			if (cache && cache[key] && cache[key].expires > Date.now()) {
				return sendReturn({value:cache[key].data});
			}
		}
	}
	
	function returnCB(t,status) {
		if (nodent.isThenable(t)) {
			return t.then(returnCB,errorCB) ;
		}
		if (!status || status==200) { 
			if (t instanceof ApiPublisher) {
				t.sendRemoteApi(req,rsp) ;
				return ;
			}
			if (cache && key) {
				cache[key] = {data:t, expires:Date.now()+1000*that.names[name].ttl.server} ;
			}
		}
		sendReturn({value:t,status:status});
	};
	
	function errorCB(err,status) {
		if (cache && key && cache[key]) {
			delete cache[key];
		}
		DEBUG(status?29:20,err,status) ;
		if (!(err instanceof Error))
			err = new Error(err.toString()) ;
		
		sendReturn({value:{error:err.message,cause:err.stack} ,status:status || 500});
	} ;

	var fn = that.api[name].fn ;
	if (fn[req.apiVersion])
		fn = fn[req.apiVersion] ; 
	
	return fn.apply(context,args).then(returnCB,errorCB) ;
};

ApiPublisher.prototype.cacheObject = function(obj) {
	return {args:obj.arguments,version:obj.request.apiVersion} ;
};

ApiPublisher.prototype.proxyContext = function(name,req,rsp,args) {
	return Object.create(this.context,{ request:{value:req}, arguments:args }) ;
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
	var url = req.url.toString() ;
	var path = url.split("/") ;
	if (path[path.length-1]=="")
		path.pop(); // Strip any trailing "/"
	req.apiVersion = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
	if (req.apiVersion>0)
		path.pop() ; // Strip the version number
	if (path.length<2 || path[1]=="") {
		this.sendRemoteApi(req,rsp) ;
	} else {
		var call = decodeURIComponent(path.pop()) ;
		var api = this ;
		for (var p=1; p<path.length; p++) {
			// nested clientInstance
			api = api.nested[path[p]] ;
			if (!api)
				return (next && next()) ;
		}
		api.callRemoteApi(call,req,rsp) ;	// Client is making a remote call
	}
} ;

module.exports = ApiPublisher;
