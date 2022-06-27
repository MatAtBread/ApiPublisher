window.RemoteApi = (function(){
  function Nothing(){};
  function ApiError(x) {
    Error.apply(this,arguments);
    this.message = x.toString();
  }
  ApiError.prototype = new Error();

  var memo = (<@afn$memo@>)({ origin:true });

  var Thenable = Promise;
  
  function cacheKey(self,args,fn) {
    if (!fn.ttl.t) // Not cachable on the client
      return undefined;
    
    var incl = fn.ttl.on;
    
    // Key on no args
    if (!incl || !incl.length)
      return ".";

    // Key on all args
    if (incl=="*") {
      return args;
    }
    
    // Key onspecific args
    var src = [];
    for (var i=0; i<incl.length; i++)
      src.push(args[incl[i]]);
    return src;
  }
  
  function setHeaders(x,headers) {
    if (headers)
      for (var name in headers) 
        if (headers.hasOwnProperty(name) && typeof headers[name]!='undefined')
          x.setRequestHeader(name,headers[name]);
  }

  function RemoteApi(url,options,onLoad) {
    function callRemoteFuncBack(that,path,name,args) {
      return new Thenable(function(callback,error) {
        if (!callback) callback = that.onSuccess;
        if (!error) error = that.onError;
        var fetchOpts = {
          method: that.method,
          headers: new Headers(),
          redirect: 'manual',
          referrerPolicy: 'no-referrer',
          credentials: 'include'
        };
        var paramData = JSON.stringify(Array.prototype.slice.call(args),that.serializer);
        fetchOpts.headers.append("Content-Type","application/json; charset=utf-8");
        //fetchOpts.headers.append("documentReferer", document.referrer)
        if (that.headers) Object.entries(that.headers).forEach(([name,value]) => fetchOpts.headers.append(name,value));
        that.apiStart(path,name,args,fetchOpts);
        var f;
        if (that.method === "GET")
          f = fetch(path+"/"+name+"/"+that.version+"?"+encodeURIComponent(paramData), fetchOpts);
        else {
          fetchOpts.body = paramData;
          f = fetch(path+"/"+name+"/"+that.version, fetchOpts);
        }
        f.then(async res => {
          var contentType = res.headers.get("Content-Type");
          if (contentType) contentType = contentType.split(";")[0]; 
          if (contentType=="application/json" || contentType=="text/plain") {
            const text = await res.text();
            var data = text;
            try {
              if (contentType=="application/json")
                data = !data?data:JSON.parse(data,that.reviver);
            } catch (ex) {
              ex.cause = {path:path,name:name,args:args};
              that.apiEnd(path,name,args,false,ex);
              return error(ex);
            }
            if (res.status>=200 && res.status<=299) {
              that.apiEnd(path,name,args,true,data);
              return callback(data);
            } else {
              var ex = new ApiError(data.message || data.error || data.cause || res.status);
              ex.httpResponse = {status: res.status, response: text, res};
              ex.cause = {path:path,name:name,args:args};
              that.apiEnd(path,name,args,false,ex);
              return error(ex);
            }
          } else {
            if (res.status==0) { // No network
              var ex = new ApiError("No network");
              ex.networkError = true;
              ex.httpResponse = {status: res.status, res};
              ex.cause = {path:path,name:name,args:args};
              that.apiEnd(path,name,args,false,ex);
              return error(ex);
            } else {
              var ex = new ApiError(res.statusText || res.status);
              ex.httpResponse = {status: res.status, res};
              ex.cause = {path:path,name:name,args:args};
              that.apiEnd(path,name,args,false,ex);
              return error(ex);
            }
          }
        }).catch(err => { 
          error(err) 
        });
        return function(){};
      });
    }

    var that = this;

    if (options) {
      Object.keys(options).forEach(function(k){
        that[k] = options[k];
      });
    }
    
    if (typeof url!="function") {
      var path = url;
      path = path.split("/");
      if (path[path.length-1]=="")
        path.pop(); // Strip any trailing "/"
      var version = Number(path[path.length-1].match(/^[0-9.]+$/)); 
      if (version && !isNaN(version)) {
        path.pop(); // Strip the version number
        this.version = version;
      }
      url = path.join("/");
    }
    
      
    if (!onLoad)
      onLoad = function(){};

    function loadApi(url,api){
      Object.keys(api).forEach(function(i) {
        if (api[i] && !(api[i].parameters === null || api[i].parameters === undefined)) {
          that[i] = function() {
            return callRemoteFuncBack(that,url,i,arguments); 
          }
          if (api[i].ttl) {
            that[i].ttl = api[i].ttl;
            that[i] = memo(that[i],{ttl:api[i].ttl.t*1000, key: cacheKey, createCache:function(cacheID){ return new that.Cache(url+"/"+i) }});
          } else {
            that[i].clearCache = Nothing;
          }
          that[i].parameters = api[i].parameters;
          that[i].remoteName = url+"/"+i; 
        } else {
          var staticVal = that.reviver?that.reviver("",api[i]):api[i]; 
          that[i] = function() {
            return new Thenable(function(ok,error) {
              return (ok || that.onSuccess)(staticVal);
            });
          };
          that[i].clearCache = Nothing;
          that[i].remoteName = url+"/"+i; 
          if (api[i]._isRemoteApi) {
            delete staticVal._isRemoteApi;
            new RemoteApi(that[i],options,function(){
              that[i] = this;
            });
          }
        }
      });
      onLoad.call(that,null);
    }
    
    if (typeof url === 'function') {
      function loadAsync(api){
        loadApi(url.remoteName,api);
      }
      url().then(loadAsync);
    } else {
      var x = new XMLHttpRequest();
      x.open("GET", url+"/"+that.version, true);
      
      x.setRequestHeader("documentReferer", document.referrer);
      setHeaders(x,that.headers);

      x.onreadystatechange = function() {
        if (x.readyState==4) {
          if (x.status==200) {
            var api = JSON.parse(x.responseText);
            loadApi(url,api);
          } else {
            onLoad.call(that,x);
          }
        }
      }
      x.send();
    }
    return this;
  }

  RemoteApi.StorageCache = function LocalStorageCache(storage){
    function StorageCache(name){
      Object.defineProperty(this,"name",{value:'RemoteAPI:'+name,configurable:true,writeable:true});
      Object.defineProperty(this,"storage",{value:storage || window.localStorage});
      this.store = Object.create(null);
      Object.assign(this.store,JSON.parse(this.storage[this.name]||"{}"));
    }
    StorageCache.prototype = {
      setStorage:function(){
        try {
          this.storage[this.name] = JSON.stringify(this.store);
        } catch (ex) {
          var s = this.storage;
          var dataByLength = Object.keys(s).sort(function(a,b){ return s[b].length-s[a].length});
          console.warn("Can't cache API data. Removed old data (",dataByLength[0],s[dataByLength[0]].length,"bytes)",ex);
          s.removeItem(dataByLength[0]);
        }
      },
      set:function(k,v){
        this.store[k] = v;
        this.setStorage();
      },
      get:function(k){
        return this.store[k];
      },
      remove:function(k){ // Deprecated in favour of delete(), like a Map
        this.delete(k); 
      },
      'delete':function(k){
        delete this.store[k];
        if (!this.keys().length)
          this.storage.removeItem(this.name);
        else
          this.setStorage();
      },
      keys:function(){
        return Object.keys(this.store);
      },
      name:'RemoteApi.StorageCache'
    };
    return StorageCache;
  };

  RemoteApi.ObjectCache = function ObjectCache(name){
    this.store = Object.create(null);
  };
  RemoteApi.ObjectCache.prototype = {
    set:function(k,v){
      this.store[k] = v;
    },
    get:function(k){
      return this.store[k];
    },
    remove:function(k){ // Deprecated in favour of delete(), like a Map
      this.delete(k); 
    },
    keys:function(){
      return Object.keys(this.store);
    },
    'delete':function(k){
      delete this.store[k];
    },
    clear:function(){
      this.store = Object.create(null);
    },
    name:'RemoteApi.ObjectCache'
  };
  
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
      var that = this;
      Object.keys(that).forEach(function(k){
        if (typeof that[k].clearCache === "function")
          that[k].clearCache();
      });
    }
  };

  RemoteApi.load = function(url,options) {
    return new Thenable(function($return,$error) {
      new RemoteApi(url,options,function(ex){
        if (ex) $error && $error(ex);
        else $return(this);
      });
    });
  };

  RemoteApi.ApiError = ApiError;
  return RemoteApi;
})();
