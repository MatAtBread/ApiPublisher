window.RemoteApi = (function(){
    function Nothing(){} ;
    function ApiError(x) {
        Error.apply(this,arguments) ;
        this.message = x.toString() ;
    }
    ApiError.prototype = new Error() ;

    var memo = (<@afn$memo@>)() ;
    Object.defineProperty(Function.prototype,"$asyncbind",{
        value:<@$asyncbind@>,
        writeable:true
    }) ;

    var Thenable ;
    try {
        Thenable = Promise ;
    } catch (ex) {
        Nothing.$asyncbind(null,true) ;
        Thenable = Nothing.$asyncbind.EagerThenable ;
    }
    
    function cacheKey(self,args,fn) {
        if (!fn.ttl.t) // Not cachable on the client
            return undefined ;
        
        var incl = fn.ttl.on ;
        
        // Key on no args
        if (!incl || !incl.length)
            return "." ;

        // Key on all args
        if (incl=="*") {
            return args ;
        }
        
        // Key onspecific args
        var src = [] ;
        for (var i=0; i<incl.length; i++)
            src.push(args[incl[i]]) ;
        return src ;
    }
    
    function setHeaders(x,headers) {
        if (headers)
            for (var name in headers) 
                if (headers.hasOwnProperty(name) && typeof headers[name]!='undefined')
                    x.setRequestHeader(name,headers[name]) ;
    }

    function RemoteApi(url,options,onLoad) {
        function callRemoteFuncBack(that,path,name,args) {
            return new Thenable(function(callback,error) {
                if (!callback) callback = that.onSuccess ;
                if (!error) error = that.onError ;
                var x = new XMLHttpRequest() ;
                x.toString = function() {
                    return path+"/"+name+"/"+that.version+":"+x.status+" - "+new Date().toString() ;
                };
                that.apiStart(path,name,args,x) ;
                x.open("POST", path+"/"+name+"/"+that.version, true);
                x.setRequestHeader("Content-Type","application/json; charset=utf-8") ;
                x.setRequestHeader("documentReferer", document.referrer);
                setHeaders(x,that.headers) ;
                x.onreadystatechange = function() {
                    if (x.readyState==4) {
                        var contentType = x.getResponseHeader("Content-Type") ;
                        if (contentType) contentType = contentType.split(";")[0] ; 
                        if (contentType=="application/json" || contentType=="text/plain") {
                            var data = x.responseText ;
                            try {
                                if (contentType=="application/json")
                                    data = !data?data:JSON.parse(data,that.reviver) ;
                            } catch (ex) {
                                ex.cause = {path:path,name:name,args:args} ;
                                that.apiEnd(path,name,args,false,ex) ;
                                return error(ex) ;
                            }
                            if (x.status==200) {
                                that.apiEnd(path,name,args,true,data) ;
                                return callback(data) ;
                            } else {
                                var ex = new ApiError(data.message || data.error || data.cause || x.status) ;
                                ex.httpResponse = {status:x.status, response: x.responseText} ;
                                ex.cause = {path:path,name:name,args:args} ;
                                that.apiEnd(path,name,args,false,data) ;
                                return error(ex) ;
                            }
                        } else {
                            if (x.status==0) { // No network
                                var ex = new ApiError("No network") ;
                                ex.networkError = true ;
                                ex.cause = {path:path,name:name,args:args} ;
                                that.apiEnd(path,name,args,false,ex) ;
                                return error(ex) ;
                            } else {
                                var ex = new ApiError(x.responseText || x.status) ;
                                ex.httpResponse = {status:x.status, response: x.responseText} ;
                                ex.cause = {path:path,name:name,args:args} ;
                                that.apiEnd(path,name,args,false,ex) ;
                                return error(ex) ;
                            }
                        }
                    }
                }
                x.send(JSON.stringify(Array.prototype.slice.call(args),that.serializer)) ;
                return x.abort.bind ? x.abort.bind(x):function(){ x.abort(); } ;
            }) ;
        }

        var that = this ;

        if (options) {
            Object.keys(options).forEach(function(k){
                that[k] = options[k] ;
            }) ;
        }
        
        if (typeof url!="function") {
            var path = url ;
            path = path.split("/") ;
            if (path[path.length-1]=="")
                path.pop(); // Strip any trailing "/"
            var version = Number(path[path.length-1].match(/^[0-9.]+$/)) ; 
            if (version && !isNaN(version)) {
                path.pop() ; // Strip the version number
                this.version = version ;
            }
            url = path.join("/") ;
        }
        
            
        if (!onLoad)
            onLoad = function(){} ;

        function loadApi(url,api){
            Object.keys(api).forEach(function(i) {
                if (api[i] && api[i].parameters) {
                    that[i] = function() {
                        return callRemoteFuncBack(that,url,i,arguments) ; 
                    }
                    if (api[i].ttl) {
                        that[i].ttl = api[i].ttl ;
                        that[i] = memo(that[i],{ttl:api[i].ttl.t*1000, key: cacheKey, createCache:function(){ return new that.Cache(url+"/"+i) }}) ;
                    } else {
                        that[i].clearCache = Nothing ;
                    }
                    that[i].parameters = api[i].parameters ;
                    that[i].remoteName = url+"/"+i ; 
                } else {
                    var staticVal = that.reviver?that.reviver("",api[i]):api[i] ; 
                    that[i] = function() {
                        return new Thenable(function(ok,error) {
                            return (ok || that.onSuccess)(staticVal) ;
                        }) ;
                    } ;
                    that[i].clearCache = Nothing ;
                    that[i].remoteName = url+"/"+i ; 
                    if (api[i]._isRemoteApi) {
                        delete staticVal._isRemoteApi ;
                        new RemoteApi(that[i],options,function(){
                            that[i] = this ;
                        }) ;
                    }
                }
            }) ;
            onLoad.call(that,null) ;
        }
        
        if (typeof url === 'function') {
            function loadAsync(api){
                loadApi(url.remoteName,api);
            }
            url().then(loadAsync) ;
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

    RemoteApi.StorageCache = function LocalStorageCache(storage){
        function StorageCache(name){
            Object.defineProperty(this,"name",{value:'RemoteAPI:'+name,configurable:true,writeable:true}) ;
            Object.defineProperty(this,"storage",{value:storage || window.localStorage}) ;
            this.store = Object.create(null) ;
            Object.assign(this.store,JSON.parse(this.storage[this.name]||"{}")) ;
        }
        StorageCache.prototype = {
            setStorage:function(){
                try {
                    this.storage[this.name] = JSON.stringify(this.store) ;
                } catch (ex) {
                    var s = this.storage ;
                    var dataByLength = Object.keys(s).sort(function(a,b){ return s[b].length-s[a].length}) ;
                    console.warn("Can't cache API data. Removed old data (",dataByLength[0],s[dataByLength[0]].length,"bytes)",ex) ;
                    s.removeItem(dataByLength[0]) ;
                }
            },
            set:function(k,v){
                this.store[k] = v ;
                this.setStorage() ;
            },
            get:function(k){
                return this.store[k] ;
            },
            remove:function(k){ // Deprecated in favour of delete(), like a Map
                this.delete(k) ; 
            },
            delete:function(k){
                delete this.store[k] ;
                if (!this.keys().length)
                    this.storage.removeItem(this.name) ;
                else
                    this.setStorage() ;
            },
            keys:function(){
                return Object.keys(this.store) ;
            }
        } ;
        return StorageCache ;
    };

    RemoteApi.ObjectCache = function ObjectCache(name){
        this.store = Object.create(null) ;
    } ;
    RemoteApi.ObjectCache.prototype = {
        set:function(k,v){
            this.store[k] = v ;
        },
        get:function(k){
            return this.store[k] ;
        },
        remove:function(k){ // Deprecated in favour of delete(), like a Map
            this.delete(k) ; 
        },
        keys:function(){
            return Object.keys(this.store) ;
        },
        delete:function(k){
            delete this.store[k] ;
        }
    } ;
    
    RemoteApi.prototype = {
        onSuccess:function(result){},
        onError:function(xhr){},
        apiStart:function(path,name,args,xhr){},
        apiEnd:function(path,name,args,error,data){},
        version:"",
        reviver:null,
        serializer:null,
        headers:null,
        log:function() {},
        Cache:RemoteApi.ObjectCache,
        clearCache:function(){
            var that = this ;
            Object.keys(that).forEach(function(k){
                if (typeof that[k].clearCache === "function")
                    that[k].clearCache() ;
            }) ;
        }
    } ;

    RemoteApi.load = function(url,options) {
        return new Thenable(function($return,$error) {
            new RemoteApi(url,options,function(ex){
                if (ex) $error && $error(ex) ;
                else $return(this) ;
            }) ;
        });
    };

    RemoteApi.ApiError = ApiError ;
    return RemoteApi ;
})() ;
