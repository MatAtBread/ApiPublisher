/**
 * ApiPublisher
 * Make server-side JS functions callable from remote clients
 * v0.1 
 * - only supports static calls (no guarantees about "this" or "new")
 * - only supports async callbacks in the "funcback" style
 * 	 i.e. those that have the form func(args...)(okCallback,errorCallback)
 */

var async = require('nodent')({use:['async']}).async ;
var DEBUG = global.DEBUG || function(){ console.log.apply(this,arguments); } ;

/**
 * Create an object representing functions that can be called remotely
 *  
 * @param rootObject	- the object containing the functions to make available remotely 
 */
function ApiPublisher(obj,opts) {
	var that = this ;
	that.api = {} ;
	that.names = {} ;
	that.opts = opts || {};

	for (var i in obj) if (obj.hasOwnProperty(i)){
		if (typeof obj[i] == 'function') {
			that.api[i] = {fn:obj[i],context:obj} ;
			that.names[i] = { parameters: obj[i].length } ; // Remote call info 
			try {
				that.names[i].parameters = obj[i].toString().match(/[^(]*(\(.*\))/)[1] ;
			} catch (ex) {
				DEBUG(40,ex) ;
			}
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
ApiPublisher.prototype.getRemoteApi = function(req,ok,path) {
	var self = this ;
	if (path)
		self.path = path ;
	async.map(self.api, function(e){
		return function(ok,error) {
			if (self.api[e].fn.clientInstance) {
				if (self.api[e].fn.length != self.api[e].fn.clientInstance.length) {
					DEBUG(20,"Warning: Remote instance function arguments not the same as declaration:",e) ;
				}
				self.api[e].fn.apply({request:req},self.api[e].fn.clientInstance)(function(instanceData){
					if (instanceData instanceof ApiPublisher) {
						 instanceData.getRemoteApi(req, ok, e) ;
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

function getConstructor(v) {
	return (v && (typeof v==='object') && !Array.isArray(v) && v.constructor && v.constructor.name && v.constructor.name!='Object') ? v.constructor.name : "" ; 
}

var stdHeaders = {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
		'Expires': '0',
		'pragma': 'no-cache'
} ;

ApiPublisher.prototype.sendRemoteApi = function(req,rsp) {
	var that = this ;
	this.getRemoteApi(req,function(instance){
		rsp.writeHead(200, stdHeaders);
		rsp.end(JSON.stringify(instance,that.opts.serialClassification(req.apiVersion)));
	},$error) ;
};

/**
 * Remote invocation of a local async funcback API. 
 **/
ApiPublisher.prototype.callRemoteApi = function(name,req,rsp) {
	var that = this ;
	// Because we like to accept nicely posted JSON, _and_ form input data, we 
	// test the body type
	var args = (req.body instanceof Array) ? req.body:[req.body] ; // Wasn't a JSON encoded argument list, so wrap it like it was

	var sendReturn = function(result){
		if (rsp.headersSent) {
			DEBUG(99,"Response already sent",name,args,result) ;
		} else {
			rsp.writeHead(result.status || 200, stdHeaders);
			var json = JSON.stringify(result.value,that.opts.serialClassification(req.apiVersion)) ;
			if (result.status>=500) {
				DEBUG(28,"5xx Response: ",req.session, json) ;
			}
			DEBUG(1,name,args) ;
			rsp.end(json);
		}
	} ;
	
	var returnCB = function(t,status) {
		sendReturn({value:t,status:status});
	};
	returnCB.error = function(err,details) {
		DEBUG(details?29:20,err,details) ;
		sendReturn({value:err,status:500});
	} ;

	if (!this.api[name]) {
		return returnCB.error(new Error("Endpoint not found: "+name),404) ;
	}
		
	// Augment "this" with the current request so the rmeoted API can query session
	// info etc.
	var context = Object.create(this.api[name].context) ;
	context.request = req ;
	
	// Because functions without an object do not have any useful scope, we also hide
	// the request in the return object so it's easy to pick up
	returnCB.req = req ;
	this.api[name].fn.apply(context,args)(returnCB,returnCB.error) ;
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

ApiPublisher.prototype.handle = function(){
	var remoted = this ;
	return function(req,rsp,next) {
		var url = req.url.toString() ;
		var path = url.split("/") ;
		if (path[path.length-1]=="")
			path.pop(); // Strip any trailing "/"
		req.apiVersion = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
		if (req.apiVersion>0)
			path.pop() ; // Strip the version number
		if (path.length<2 || path[1]=="") {
			remoted.sendRemoteApi(req,rsp) ;
		} else {
			remoted.callRemoteApi(decodeURIComponent(path.pop()),req,rsp) ;	// Client is making a remote call
		}
	} ;
};

ApiPublisher.jsonReviver = function(k,v){
	// Strip off the class marker
	if (k=='\u00A9' || k=="_clz")
		return undefined ;
	return v ;
};

module.exports = ApiPublisher;
