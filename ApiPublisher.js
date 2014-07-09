/**
 * ApiPublisher
 * Make server-side JS functions callable from remote clients
 * v0.1 
 * - only supports static calls (no guarantees about "this" or "new")
 * - only supports async callbacks in the "funcback" style
 * 	 i.e. those that have the form func(args...)(okCallback,errorCallback)
 */

var async = require('nodent')({use:['async']}).async ;
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
	async.map(self.api, function(e){
		return function(ok,error) {
			var fn = self.api[e].fn ;
			if (fn[req.apiVersion])
				fn = fn[req.apiVersion] ;
			if (fn.clientInstance) {
				if (fn.length != fn.clientInstance.length) {
					DEBUG(20,"Warning: Remote instance function arguments not the same as declaration:",e) ;
				}
				fn.apply({request:req},fn.clientInstance)(function(instanceData){
					if (instanceData instanceof ApiPublisher) {
						 instanceData.getRemoteApi(req, e, ok) ;
					} else {
						ok(instanceData) ;
					}
				},error) ;
			} else {
				ok(self.names[e]) ;
			}
		};
	})
	(ok,$error) ;
};

var stdHeaders = {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
		'Expires': 'Fri, 01 Jan 1990 00:00:00 GMT',
		'pragma': 'no-cache'
} ;

ApiPublisher.prototype.sendRemoteApi = function(req,rsp) {
	var that = this ;
	this.getRemoteApi(req,null,function(instance){
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
var json = require('./pushJSON') ;

ApiPublisher.prototype.callRemoteApi = function(name,req,rsp) {
	var that = this ;
	// Because we like to accept nicely posted JSON, _and_ form input data, we 
	// test the body type
	var args = (req.body instanceof Array) ? req.body:[req.body] ; // Wasn't a JSON encoded argument list, so wrap it like it was
	var tStart = Date.now() ;
	function sendReturn(result){
		if (rsp.headersSent) {
			DEBUG(99,"Response already sent",name,args,result) ;
		} else {
			rsp.writeHead(result.status || 200, stdHeaders);
			if (result.status>=500) {
				DEBUG(28,"5xx Response: ",req.session) ;
			}
			DEBUG(1,name,args," "+(Date.now()-tStart)+"ms") ;
			//json.Readable(result.value,that.serializer(req,rsp)).pipe(rsp) ;
			json.writeToStream(rsp,result.value,that.serializer(req,rsp),function(){ rsp.end(); }) ;
			//var json = JSON.stringify(result.value,that.serializer(req,rsp)) ;
			//rsp.end(json);
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
		if ((!status || status==200) && cache && key) {
			cache[key] = {data:t, expires:Date.now()+1000*that.names[name].ttl.server} ;
		}
		sendReturn({value:t,status:status});
	};
	
	function errorCB(err,details) {
		if (cache && key && cache[key]) {
			delete cache[key];
		}
		DEBUG(details?29:20,err,details) ;
		sendReturn({value:err,status:500});
	} ;

	if (!that.api[name]) {
		return errorCB(new Error("Endpoint not found: "+name),404) ;
	}
	
	var fn = that.api[name].fn ;
	if (fn[req.apiVersion])
		fn = fn[req.apiVersion] ; 
	
	fn.apply(context,args)(returnCB,errorCB) ;
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
		this.callRemoteApi(decodeURIComponent(path.pop()),req,rsp) ;	// Client is making a remote call
	}
} ;

module.exports = ApiPublisher;
