/**
 * A Node-friendly way to initialise a remote API. cf: RemoteApi.js in the client
 */

var URL = require('url') ;

function getOwnPropertyDescriptions(obj) {
	var d = {};
	Object.keys(obj).forEach(function(k){
		d[k] = Object.getOwnPropertyDescriptor(obj,k) ;
	});
	return d ;
} ;

function callRemoteFuncBack(that,path,args) {
	return new (that.ThenableProvider)(function(callback,error) {
		if (!callback) callback = that.onSuccess.bind(that) ;
		if (!error) error = that.onError.bind(that) ;

		var uriRequest = URL.parse(path) ;
		uriRequest.method = "POST" ;
		that.setHttpOptions(uriRequest) ;
			
		var tStart = Date.now() ;
		var x = require(uriRequest.protocol.match(/(http|https):/)[1]).request(uriRequest, function(res){
			res.setEncoding('utf8');
			var body = "" ;
			res.on('data', function (chunk) { body += chunk ; });
			res.once('end',function(){
				var contentType = res.headers['content-type'] ;
				if (contentType) contentType = contentType.split(";")[0] ; 
				if (res.statusCode==200) {
					var data = body ;
					if (contentType=="application/json")
						data = !data?data:JSON.parse(data,that.reviver) ;
					callback(data) ;
				} else {
					if (contentType=="application/json") {
						var exception = JSON.parse(body,that.reviver) ;
						var exc = new Error(exception.message || exception.error || exception.toString()) ;
						Object.defineProperties(exc, getOwnPropertyDescriptions(exception)) ;
						error(exc) ;
					} else {
						error(new Error(body)) ;
					}
				}
			}) ;
		}).on('error', function(e) {
			error(e) ;
		}) ;

		x.setHeader("Content-Type","application/json; charset=utf-8") ;
		x.write(JSON.stringify(Array.prototype.slice.call(args),that.serializer)) ;
		x.end() ;
	});
}

function constructApi(serverApi,baseUrl,that,api) {
	Object.keys(api).forEach(function(i){
		if (api[i]._isRemoteApi) {
			delete api[i]._isRemoteApi ;
			that[i] = {} ;
			constructApi(serverApi,baseUrl+"/"+i,that[i],api[i]) ;
		} else {
			that[i] = function() { 
				return callRemoteFuncBack(serverApi,baseUrl+"/"+i+"/"+serverApi.version,arguments) ; 
			};
		}
	}) ;
}

function ServerApi(url,onLoad, ThenableProvider) {
	var that = this ;
	that.ThenableProvider = ThenableProvider ;
	
	if (!onLoad) onLoad = function(){};

	var u = (typeof url==='string')?URL.parse(url):url ;
	var path = u.pathname.split("/") ;
	if (path[path.length-1]=="")
		path.pop(); // Strip any trailing "/"
	that.version = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
	if (that.version>0) {
		path.pop() ; // Strip the version number
	} else {
		this.version = "" ;
	}
	u.pathname = path.join("/") ;
	url = URL.format(u) ;
	var accessURL = URL.parse(url+"/"+that.version) ;
	Object.keys(u).forEach(function(k){
		if (!(k in accessURL))
			accessURL[k] = u[k] ;
	}) ;
	require(u.protocol.match(/(http|https):/)[1]).get(accessURL, function(res) {
		if (res.statusCode != 200) {
			var ex = new Error("HTTP response "+res.statusCode+" "+url.toString()) ;
			ex.errorObject = res ;
			onLoad.call(that,ex) ;
		} else {
			res.setEncoding('utf8');
			var body = "" ;
			res.on('data', function (chunk) { body += chunk ; });
			res.once('end',function(){
				var api = JSON.parse(body) ;
				constructApi(that,url,that,api) ;
				onLoad.call(that,null) ;
			}) ;
		}
	}).on('error', function(e) {
		onLoad.call(that,e) ;
	});
};

ServerApi.prototype.onSuccess = function(result){};
ServerApi.prototype.onError = function(error){};
ServerApi.prototype.headers = null ;
ServerApi.prototype.serializer = null ;
ServerApi.prototype.reviver = null ;
ServerApi.prototype.setHttpOptions = function(url) {
	var that = this ;
	if (that.headers) {
		url.headers = url.headers || {} ;
		Object.keys(that.headers).forEach(function(k){
			url.headers[k] = that.headers[k] ;
		}) ;
	}
}

ServerApi.load = function(url,ThenableProvider) {
    ThenableProvider = ThenableProvider || Promise ;
	return new ThenableProvider(function($return,$error) {
		new ServerApi(url,function(ex){
			if (ex) $error(ex) ;
			else $return(this) ;
		},ThenableProvider) ;
	});
};

module.exports = ServerApi ;
