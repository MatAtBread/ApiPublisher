window.RemoteApi = (function(){
	function setHeaders(x,headers) {
		if (headers)
			for (var name in headers) 
				if (headers.hasOwnProperty(name) && typeof headers[name]!='undefined') {
					x.setRequestHeader(name,headers[name]) ;
				}
	}

	function RemoteApi(url,options,onLoad) {
		function callRemoteFuncBack(that,path,name,args) {
			return function(callback,error) {
				that.apiStart(path,name,args) ;
				if (!callback) callback = that.onSuccess ;
				if (!error) error = that.onError ;
				var x = new XMLHttpRequest() ;
				x.toString = function() {
					return path+"/"+name+"/"+that.version+":"+x.status+" - "+new Date().toString() ;
				};
				x.open("POST", path+"/"+name+"/"+that.version, true);
				x.setRequestHeader("Content-Type","application/json") ;
				x.setRequestHeader("documentreferer", document.referrer);
				setHeaders(x,that.headers) ;
				x.onreadystatechange = function() {
					if (x.readyState==4) {
						if (x.getResponseHeader("Content-Type")=="application/json") {
							var data = x.responseText ;
							try {
								data = !data?data:JSON.parse(data,that.reviver) ;
							} catch (ex) {
								that.apiEnd(path,name,args,false) ;
								return error(ex) ;
							}
							if (x.status==200) {
								that.apiEnd(path,name,args,true) ;
								return callback(data) ;
							} else {
								var toString = data.toString.bind(data) ;
								data.toString = function() { return x.toString()+"\n"+toString() } ;
								that.apiEnd(path,name,args,false) ;
								return error(data) ;
							}
						} else {
							if (x.status==0) { // No network
								var ex = new Error() ;
								ex.networkError = true ;
								that.apiEnd(path,name,args,false) ;
								return error(ex) ;
							} else {
								var ex = new Error() ;
								ex.toString = function() { return x.toString()+": Bad response\n\n"+x.responseText ; } ;
								that.apiEnd(path,name,args,false) ;
								return error(ex) ;
							}
						}
					}
				}
				x.send(JSON.stringify(Array.prototype.slice.call(args),that.serializer)) ;
				return x.abort.bind ? x.abort.bind(x):function(){ x.abort(); } ;
			}
		}

		var that = this ;

		if (options) {
			Object.keys(options).forEach(function(k){
				that[k] = options[k] ;
			}) ;
		}
		
		var path = typeof url=="function"?url.remoteName:url ;
		path = path.split("/") ;
		if (path[path.length-1]=="")
			path.pop(); // Strip any trailing "/"
		var version = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
		if (version && !isNaN(version)) {
			path.pop() ; // Strip the version number
			this.version = version ;
		}
		url = path.join("/") ;
			
		if (!onLoad)
			onLoad = function(){} ;

		function loadApi(url,api){
			Object.keys(api).forEach(function(i) {
				if (api[i] && api[i].parameters) {
					that[i] = function() { 
						return callRemoteFuncBack(this,url,i,arguments) ; 
					}
					that[i].parameters = api[i].parameters ;
				} else {
					var staticVal = that.reviver?that.reviver("",api[i]):api[i] ; 
					that[i] = function() {
						return function(ok,error) {
							return (ok || that.onSuccess)(staticVal) ;
						} ;
					} ;
				}
				that[i].remoteName = url+"/"+i ; 
			}) ;
			onLoad.call(that,null) ;
		}
		
		if (typeof url === 'function') {
			url()(function(api){
				loadApi(url.remoteName,api) ;
			}) ;
		} else {
			var x = new XMLHttpRequest() ;
			x.open("GET", url+"/"+that.version, true);
			
			x.setRequestHeader("documentReferer", document.referrer);
			setHeaders(x,that.headers) ;

			x.onreadystatechange = function() {
				if (x.readyState==4) {
					if (x.status==200) {
						var api = JSON.parse(x.responseText) ;
						loadApi(url,api) ;
					} else {
						onLoad.call(that,x) ;
					}
				}
			}
			x.send() ;
		}
		return this;
	}

	RemoteApi.prototype = {
		onSuccess:function(result){},
		onError:function(xhr){},
		apiStart:function(path,name,args,data){},
		apiEnd:function(path,name,args,data){},
		version:"",
		reviver:null,
		serializer:null,
		headers:null
	} ;

	RemoteApi.load = function(url,options) {
		return function($return,$error) {
			new RemoteApi(url,options,function(ex){
				if (ex) $error(ex) ;
				else $return(this) ;
			}) ;
		};
	};

	return RemoteApi ;
})() ;
