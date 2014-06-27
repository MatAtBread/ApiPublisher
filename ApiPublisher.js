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

/**
 * Remote invocation of a local async funcback API. 
 **/
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
			var json = JSON.stringify(result.value,that.serializer(req,rsp)) ;
			if (result.status>=500) {
				DEBUG(28,"5xx Response: ",req.session, json) ;
			}
			DEBUG(1,name,args," "+(Date.now()-tStart)+"ms") ;
			rsp.end(json);
		}
	} ;
	
	function returnCB(t,status) {
		sendReturn({value:t,status:status});
	};
	function errorCB(err,details) {
		DEBUG(details?29:20,err,details) ;
		sendReturn({value:err,status:500});
	} ;

	if (!this.api[name]) {
		return errorCB(new Error("Endpoint not found: "+name),404) ;
	}
		
	// Proto-augment "this" with the current request so the remoted API can query session
	// info etc.
	var context = that.proxyContext(name,req,rsp) ;
	
	var fn = that.api[name].fn ;
	if (fn[req.apiVersion])
		fn = fn[req.apiVersion] ; 
	
	fn.apply(context,args)(returnCB,errorCB) ;
};

ApiPublisher.prototype.proxyContext = function(name,req,rsp) {
	return Object.create(this.context,{ request:{value:req} }) ;
};

ApiPublisher.prototype.serializer = function(req,rsp) {
	return function() { return null } ;
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
