/**
 * A Node-friendly way to initialise a remote API. cf: RemoteApi.js in the client
 */
var http = require('http') ;
var URL = require('url') ;

var DEBUG = global.DEBUG || function(){} ;

function getOwnPropertyDescriptions(obj) {
	var d = {};
	Object.keys(obj).forEach(function(k){
		d[k] = Object.getOwnPropertyDescriptor(obj,k) ;
	});
	return d ;
} ;

function callRemoteFuncBack(that,path,args) {
	return function(callback,error) {
		if (!callback) callback = that.onSuccess.bind(that) ;
		if (!error) error = that.onError.bind(that) ;

		var uriRequest = URL.parse(path) ;
		uriRequest.method = "POST" ;
		if (that.options.headers) {
			uriRequest.headers = uriRequest.headers || {} ;
			Object.keys(that.options.headers).forEach(function(k){
				uriRequest.headers[k] = that.options.headers[k] ;
			}) ;
		}
			
		var tStart = Date.now() ;
		var x = http.request(uriRequest, function(res){
			res.setEncoding('utf8');
			var body = "" ;
			res.on('data', function (chunk) { body += chunk ; });
			res.once('end',function(){
				if (res.statusCode==200) {
					DEBUG(1,path,args,res.statusCode,(Date.now()-tStart)+"ms") ;
					var data = body ;
					callback(!data?data:JSON.parse(data)) ;
				} else {
					DEBUG(25,path,args,res.statusCode,(Date.now()-tStart)+"ms\n"+body) ;
					if (res.headers['content-type']=="application/json") {
						var exception = JSON.parse(body) ;
						var exc = new Error(body) ;
						Object.defineProperties(exc, getOwnPropertyDescriptions(exception)) ;
						exc.constructor = Error ;
						error(exc) ;
					} else {
						error(new Error(body)) ;
					}
				}
			}) ;
		}).on('error', function(e) {
			error(e) ;
		}) ;

		x.setHeader("Content-Type","application/json") ;
		x.write(JSON.stringify(Array.prototype.slice.call(args),that.options.serializer)) ;
		x.end() ;
	};
}

function ServerApi(url,options,onLoad) {
	if (typeof options==="function") {
		onLoad = options ;
		options = {} ;
	}
	this.options = options || {};

	var that = this ;
	if (!onLoad) onLoad = function(){};

	var u = (typeof url==='string')?URL.parse(url):url ;
	var path = u.pathname.split("/") ;
	if (path[path.length-1]=="")
		path.pop(); // Strip any trailing "/"
	that.apiVersion = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
	if (that.apiVersion>0) {
		path.pop() ; // Strip the version number
	} else {
		this.apiVersion = "" ;
	}
	u.pathname = path.join("/") ;
	url = URL.format(u) ;
	
	http.get(url+"/"+that.apiVersion, function(res) {
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
				Object.keys(api).forEach(function(i){
					that[i] = function() { 
						return callRemoteFuncBack(that,url+"/"+i+"/"+that.apiVersion,arguments) ; 
					};
				}) ;
				onLoad.call(that,null) ;
			}) ;
		}
	}).on('error', function(e) {
		onLoad.call(that,e) ;
	});
};

ServerApi.prototype.onSuccess = function(result){};

ServerApi.prototype.onError = function(xhr){
	DEBUG(10,xhr.status,xhr.responseText) ;
};

ServerApi.prototype.onLoad = function(){};

ServerApi.load = function(url,options) {
	return function($return,$error) {
		new ServerApi(url,options,function(ex){
			if (ex) $error(ex) ;
			else $return(this) ;
		}) ;
	};
};

module.exports = ServerApi ;
