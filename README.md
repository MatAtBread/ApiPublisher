ApiPublisher
============

ApiPublisher is a simple framework to extend asynchronous calls or Promises across over HTTP. Tested clients exist for NodeJS and web-browsers, and a publisher (server) for NodeJS. The goal of ApiPublisher is provide an identical asynchronous API across clients and servers so that dependent routines can execute at any location without modification.

ApiPublisher works with Connect, Express and Nodent [https://www.npmjs.org/package/nodent] seamlessly.

ApiPublisher has been in use since November 2013 in production systems.

NB: ApiPublisher v1.1.x has a breaking change. In order to be compatible with Express 4, and as part of optimizing nested APIs, you must now pass
`api.handle` to `app.use()`, NOT just `api`. RemoteApi now automatically provisions nested APIs.

Installation
============

	npm install apipublisher

Usage
=====

ApiPublisher consists of three components. One to expose APIs from a nodejs server (ApiPublisher), one to call these APIs from another nodejs server (ServerApi) and one to call these APIs from a browser (RemoteApi).

All APIs must return a Promise, or conform to the "funcback" pattern (where a function returns asynchronously by returning a function that accepts to callback arguments - one for the return value, one for exceptions). You can find out more about [choosing between "funcbacks" and Promises](https://github.com/MatAtBread/nodent#es7-and-promises).

You do not have to use ES7 (or anything else) to use ApiPublisher, but the ES7 keywords `async` and `await` make writing async code much easier. If you do not use an ES7 transpiler, you can still call remote functions (as they return Promises) or as "funcbacks".

Using [Nodent](https://github.com/MatAtBread/nodent) or another ES7 engine these can be called as:

	var success = await myAsyncFunction(...arguments...) ;

and declared as:

	async function myAsyncFunction(...arguments...) {
		return ...result... ;
	}

Note the use of Nodent to generate Promises or funcback patterned calls is entirely optional. Within this README, Nodent is used in some of the examples for brevity. If you don't wish to use teh ES7 syntax, the ES5 equivalents for calling a remote function are:

	var success = myAsyncFunction(...arguments...).then(function(result){....}) ;
	
and:

	function myAsyncFunction(...arguments...) {
		return new Promise(function(resolve,error) {
			return resolve(...result...) ;
		}) ;
	}

Changelog
=========

20Feb16: Generalize browser data response caching into the prototype RemoteApi.prototype.Cache to allow for other storage implementations that a simple JS object. Provide RemoteApi.StorageCache as an alternative that works with (for example) window.localStorage or window.sessionStorage.

13May15: Allow ServerApi.load() to accept a Url object instead of a string url, to allow for additional options (such as the agent field) to be passed to Node's http module.

19Feb15: NB: ApiPublisher v1.1.x has a breaking change. In order to be compatible with Express 4, and as part of optimizing nested APIs, you must now pass `api.handle` to `app.use()`, NOT just `api`. RemoteApi now automatically provisions nested APIs.

17Feb15: Updated to use the latest ES7-compliant version of Nodent and Promises.

14Jul14: Implement ApiPublisher.prototype.sendReturn(). Allow for "text/plain" responses which are not parsed into JSON but simply returned to the callee asynchronously as strings.

04Jul14: Add server-side caching (see lazy cachinge below). Add "arguments" to the server proxyContext (UPDATED)

27Jun14: Enable lazy caching (see below)

26Jun14: Fix issue where nested APIs are called with the version number in the incorrect position within remote URL

Declaring an API for remoting
-----------------------------

Simply collect together the async calls (or functions returning Promises) in an object:

	var myAPI = {
		doSearch:async function(term) {
			var result = {} ; 
			// search here
			return result ;
		},
		loginUser:async function(uid,pwd) {
			// Examine user DB and generate session
			return sessionKey ;
		}
	} ;

This API can be called locally (of course), for example:

	results = await myAPI.doSearch("Hello") ;

To expose the APIs in nodejs, create a new ApiPublisher from your object and server it from the URL of your choice.

	var ApiPublisher = require("apipublisher").ApiPublisher ; // Allow APIs to be exposed
		...
	var publishedApi = new ApiPublisher(myAPI) ;
		...
	var app = connect();		// This example uses Sencha Connect	
	app.use(connect.json());	// Published APIs expect a JSON encoded request.body
	app.use("/api", publishedApi.handle)  ; // NB: As of ApiPublisher v1.1.x & Express 4, the ".handle" is required
	
	// Iff we want to make the API available to browsers, 
	// also expose the RemoteApi script for them to load
	app.use("/js/RemoteApi.js", require("apipublisher").sendRemoteApi) ;
		...
	http.createServer(app).listen(7999);

This will expose the API at the URL "/api". Specifically, it will, in this case, handle incoming requests to "/api/doSearch" and "/api/loginUser", as defined by our API. Note that only functions are exported - if myAPI contained data or other members, these are currently ignored when the API is published.
		
Calling a remote API from nodejs
--------------------------------

To call a published API from node, require the ServerApi, and initialise it from the remote URI :

	var ServerApi = require("apipublisher").ServerApi ; // Allow APIs to be called
		...
	var api = await ServerApi.load("http://example.com/api") ;
		...
	// Call the API:
	var user = await api.loginUser("matt","atbread") ;
	if (user) {
		result = await api.doSearch("Hello") ;
	}

Note the API is called with exactly the same syntax, semantics and parameters as if it had be called locally (see above).

Call a remote API from a browser
--------------------------------

On the server, you should expose "RemoteApi.js" from some path, or if preferred copy or symlink it from the package into your existing static web resources

On the client, you need to include that script, and then load the remote API as above. In the example below, we're assing the API exists on the same URI as the content files (HTML, JS).

	<script src="/js/RemoteApi.js"></script>
	<script>
		RemoteApi.load("/api").then(function(api){
			window.api = api ; // Save the API for use later.
		},function(err){
			alert("Failed to load API: "+err.message) ;
		}) ;
			...
		document.getElementById("loginButton").onclick = function(){
			api.loginUser(userName,password).then(function(done){
				window.user = done ;
			}) ;
		} ;

	</script>

Using Nodent's "generateRequestHandler" to make the browser scripts more readable and maintainable, is also easy:
	
	// index.html
	<script src="/js/RemoteApi.js"></script>
	<script src="/js/app.njs"></script>

	// app.njs
	function $error(err) {
		alert("Failed to load API: "+err.message) ;
	} ;
	window.api = await RemoteApi.load("/api") ;
		...
	document.getElementById("loginButton").onclick = function(){
		window.user = await api.loginUser(userName,password) ;
	} ;

Example
========

A full example of a nodejs-based published API, nodejs API client and browser client can be in the /test directory of the ApiPublisher package. 

To start the API server:

	node server.js

To access the API from a nodejs client

	node client.js

To access the API from a browser, go to http://localhost:1966

The example shows both traditional Javascript (.js) and Nodent-transcoded Javascript (.njs) in the client

ApiPublisher options and prototype
==================================

prototype.proxyContext(name,req,rsp,args)
-----------------------------------------
When reading and parsing a remote API request, prior to calling the specified function within the server, the "this" object is generated by this prototype. By default, the "this" has the original API collection as it's prototype, and is augmented with a member "request" that is set to the incoming request. Taking the "myApi" example above, if called from within the server directly, "this" (as usual) will be the object myApi. If called remotely, it will be an object whose prototype is "myApi" and with an additional member "request", for example:

	myApi.radius = new RadiusServer(....) ;
	
	myApi.loginUser = async function(uid,pwd) {
		// "this" is "myApi", and it has an object called "radius" that is visible as usual
		var user = await this.radius.validateUser(uid,pwd) ; 
		// If remote, check the request's source IP
		if (this.request && !this.request.socket.remoteAddress.match(/192\./))
			throw new Error("Illegal login access attempt") ;
		return user ;
	}

Using this feature of the prototype.proxyContext allows you to test for session information, referrer, headers, etc. during the processing of remote calls. The default implementation is:

	ApiPublisher.prototype.proxyContext = function(name,req,rsp, args) {
		return Object.create(this.context,{ request:{value:req}, arguments:{value:args} }) ;
	};

The "arguments" parameter is provided as within the funcbank pattern or Nodented calls, the usual Javascript "arguments" object refers to the set [$return,$error] (i.e. the callbacks). This provides for call sequences such as:

	myApi.getUserProfile = async function(uid,pwd) {
		return = await this.getUser.apply(this.arguments) ; // refers to [uid,pwd]
	};

Overriding this behaviour allows for other variables to take part in remote API request processing (e.g. closures or similar). Re-assign the member after creation:

	var httpServer = http.createServer(app) ;
	var publishedApi = new ApiPublisher(myAPI) ;
	// For our API, we want to expose the server too.
	publishedApi.proxyContext = function(name,req,rsp) {
		return Object.create(this.context,{ request:{value:req}, arguments:{value:args}, server:{value:httpServer} }) ;
	}

prototype.cacheObject(content)
------------------------------
Called when data is cachable on the server and the return is used to generate a cache key.

prototype.serializer(req,rsp)
-----------------------------
Asynchronous returns and API definitions are returned in JSON format using the standard node JSON.stringify. This value is passed as the second parameter to JSON.stringify to allow for processing of returns at the "transport" layer, as opposed to the logical, API layer. For example, to include a class marker in all top-level responses:

	var publishedApi = new ApiPublisher(myAPI) ;
	// For our API, we want to expose the server too.
	publishedApi.serializer = function(req,rsp) {
		return function(key,value) {
			if (key=="" && value && value.constructor && value.constructor.name)
				value['\u00A9'] = value.constructor.name ;
		}
	}

The request and response are passed to the serializer to enable responses to be modified depending on (for example) security checks, client type, etc.

The default implement does simple JSON serialization with no modification.

prototype.sendReturn(req,rsp,result,status)
------------------------------------------
Provides a way to intercept (and modify) the final sending phase so that, for example, alternative serializers can be used to send data to a client.

The default implemenatation is :

	var json = JSON.stringify(result,this.serializer(req,rsp)) ;
	rsp.end(json);

Setting additional and/or replacement headers and statuCodes is possible here as although defaults have been set by the time the function is called, no writing has commenced. If your objects are very big (>500k), using a streaming JSON serializer works well to keep Node's event loop co-operative. For example, with pushjson (https://www.npmjs.org/package/pushjson):

	var pj = require('pushjson') ;
	myApi.sendReturn = function(req,rsp,result,status){
		// Serialize and send asynchronously
		pj.Readable(result).pipe(rsp) ;
	} ;


ServerApi options and prototype
===============================

prototype.onSuccess(result) 
---------------------------
Called if a remote API is called with a null or undefined success callback.

prototype.onError(error) 
------------------------
Called if a remote API is called with a null or undefined error callback.

prototype.headers 
-----------------
An object containing key-value pairs to be sent as HTTP headers with every request. Headers are unused by ApiPublisher itself, and should be considered "out of band" and used (for example) for session management.

prototype.serializer(key,value)
-------------------------------
Standard JSON serializer routine used to serialize remote API function arguments before being sent to the server.

prototype.reviver(key,value)
----------------------------
Standard JSON reviver routine used to de-serialize remote API function results & errors before being passed to the asynchronous callee.

RemoteApi options and prototype
===============================

The RemoteApi scripts accepts the same prototype overrides as the ServerApi (above), and the following additional prototypes:

prototype.apiStart(path,name,args,data)
------------------------------------------------
Called before every remote API call is sent over the network. Useful for debugging and providing UI feedback that a network operation is underway.

prototype.apiEnd(path,name,args,data)
----------------------------------------------
Called after every remote API call has responded, but before the callee is called-back. Useful for debugging and providing UI feedback that a network operation has finished.

prototype.log(...)
----------------------------------------------
Called to provide tracing/debugging support. The default implementation does nothing.

prototype.version
-----------------
See the section below on versioning

prototype.version
-----------------
See the section below on versioning

RemoteApi.noLazyCache
---------------------
If thruthy, disables lazy caching of remote API results.

RemoteApi.cacheSweepInterval
----------------------------
The period, in milliseconds, between throwing out old, cached responses. By default the value is 1 minute.

(remoteapi).clearCache()
----------------------
For browser use, results can be cached (see Lazy Caching below). Every API has a method "clearCache" to discard any cached results and force a network call. For example:

	api = await RemoteApi.load("/apiExposed") ;
	api.loginUser.clearCache() ;
	result = await api.loginUser("mat","atbread") ;

Note that all functions have a "clearCache" method, even if they are not cachable. In this case, the function does nothing. The return from clearCache() is the api function, so you can chain a clear and a remote call with:

	api = await RemoteApi.load("/apiExposed") ;
	result = await api.loginUser.clearCache()("mat","atbread") ;


RemoteApi.load(url,options)
---------------------------
An optional "options" object can be used to override the prototypes at creation time, for example:

	myApi = await RemoteApi.load("/api",{
		version:3,
		noLazyCache:true,
		headers:{"X-Requested-With":"BreadBaker/1.3"},
		onError:function(e){
			alert("Oops!\n\n"+e.message) ;
		}
	}) ;

Versioning
==========
In general, since the APIs and scripts calling them are delivered by the same server, there is no reason to worry about versioning since the API implementation on the server can only be called by a client that has the script delivered from the same source (with the exception of cached scripts, etc). However, it is useful to be able to version APIs in complex, clustered environemnets, or where the client code has not been delivered by the server - for example Hybrid mobile applications where "RemoteApi.js" and the application API on top have been shipped independently and are not readily updatable.

ApiPublisher supports versioning of the API at the server via the loadable URL. By default all APIs are requested (and provided) as "latest" - no version number is supplied by the client and none is used by the server.

Consider the following API:

	myApi.getUserName = async function() {
		var user = readUserFromDB(this.request.session.uid) ;
		return user.firstName+" "+user.lastName ;
	}

Accessible (as usual) at "/api/getUserName".

We subsequently decide to provider a more detailed return:	

	myApi.getUserName = async function() {
		var user = readUserFromDB(this.request.session.uid) ;
		return {name:user.firstName+" "+user.lastName,
			firstName:user.firstName,
			lastName:user.lastName} ;
	}

Clearly, this will break all existing clients which expect the old-style return. We can support both versions as follows:

	// "Latest" version
	myApi.getUserName = async function() {
		var user = readUserFromDB(this.request.session.uid) ;
		return {name:user.firstName+" "+user.lastName,
			firstName:user.firstName,
			lastName:user.lastName} ;
	}

	// Old version:
	myApi.getUserName[1] = async function() {
		user = this.getUserName() ;
		return user.firstName+" "+user.lastName ;	// Old style - just a string
	}

This versioned API will be accessible at "/api/getUserName/1". To support this from clients which do not update automatically (i.e. where the code has shipped and is fixed, such as mobile applications), a version can be passed to both ServerApi and RemoteApi within the URL:

	api = await RemoteApi.load("http://example.com/api/1") ;

This "fixes" the API at version "1". Note: version numbers must be integers greater than zero.

"clientInstance"
================
Remote API calls that are "static", unchanging or fixed for a reasonable period of time (such as for the duration of a session) can have their results transported in the initial API call, rather than on every invokation. To acheive this, on the server side the API call should have a property called "clientInstance" set to the argument list suitable for the call. Continuing the example above:

	myApi.getUserName.clientInstance = [] ; // getUserName doesn't take any arguments

When the API is accessed via the URL "/api/getUserName", rather than transport the call information, the function is invoked directly and the result serialized instead, but is still callable from the client using the same API signature:

	name = await api.getUserName() ;

	// or, using traditional Javascript
	api.getUserName()(function(name){ ... }) ;

These calls, although they look identical won't require a network round trip as they are sent in the inital API.

"clientInstance" calls are only supported by RemoteApi. ServerApi always makes the network round trip.

Lazy Caching
============
For expensive network calls whose responses are not entirely dynamic, it is possible to cache responses in the client. In order to acheive this, add the following to your function declartation in the server:

	myApi.getUserName = async function() {
		....
		return name ;
	}
	/* Cache the response to this call for upto 60 seconds in the client */
	myApi.getUserName.ttl = {t:60} ;	

Unlike "clientInstance", at least one network call will be made to the remoted API, but the client will hold the result for the specified number of seconds, and repeated calls to the same API will re-present the previous result.

Often, it is only useful to cache responses based on the arguments to the remote call. For example, a call to get a user's friends cannot re-present the same response for all users:

	myApi.getFriends = async function(userID) {
		....
		return friends ;
	}
	/* Cache the response to this call for upto 60 seconds in the client, dependent on argument 0 (userID) */
	myApi.getFriends.ttl = {t:60,on:[0]} ;	

This instructs the client to retain a different response for remote calls with a specific value for "userID", so:

	friendsOfMatt = await api.getFriends("matt") ;
	friendsOfAlex = await api.getFriends("alex") ;
	friendsOfMe = await api.getFriends("matt") ;

...will make 2 network calls, (one for "matt", one for "alex") and store separate results in the cache.

You can pick and choose which parameters should be used for the cache key:
	
	/* Cache, disregarding the parameters */
	on:[] // (or null, or undefined) 

	/* Cache, depending on parameter 0 and 2, ignoring the value of any other arguments */
	on:[0,2] 

	/* Cache depending on all parameters */
	on:"*" 

IMPORTANT: Don't use lazy caching for highly secure, important or personal data. The client cache key is derived from a hash of the arguments provided, and so the (unlikely) possibility exists that the local cache will re-present the results of a previous call even if the arguments to the call have changed. The hash key is based on the primitive values in the arguments, not any references, so code like the following example will cache.

	var arg1 = {name:"alex"} ;	
	var arg2 = {name:"alex"} ;	
	x = await api.findUser(arg1) ;	// Network trip & cache
	x = await api.findUser(arg2) ;	// Different argument, same values - cached response used
	arg1.id = "123456" ;
	x = await api.findUser(arg1) ;	// Network trip - same argument (arg1), but values are different

Lazy Caching is only supported by RemoteApi. ServerApi always makes the network round trip.

The actual browser storage is determined by the RemoteApi.prototype.Cache value. The default value of this member is RemoteApi.ObjectCache, which simply stores data within a JS object. An alternative is provided which caches data in a WebAPI Storage object, such as window.localStorage or sessionStorage. To enable one of these caching strategies (or to define your own), include the following after the RemoteApi.js script is loaded, but before an API is loaded:

	<script src="js/RemoteApi.js"></script>
	<script>
	// Use window.localStorage for cached values
	RemoteApi.prototype.Cache = RemoteApi.StorageCache(window.localStorage) ;
	// Load the api
	RemoteApi.load('/data').then(function(api){
		window.api = api ;
	},console.error.bind(console)) ;

Server-side caching
===================
For data that is expensive to generate (for example from a complex DB call or multiple HTTP servers), call results can be cached by the server. The main advantage here is that multiple-clients will use the same cache, reducing expensive calls on the server. The main disadvantages are that (1) it doesn't prevent multiple network calls from a single client (although it can be combined with client-side Lazy Caching above), and (2) that by default, results are in commmon to all clients (see below on how to modify this behaviour).

To enable server-side result caching, add a "server" member to your "ttl" function:

	myApi.expensive = async function(..) { ... } ;
	/* cache this result in the client for 5 minutes, and on the server for 30 seconds */
	myApi.expensive.ttl = {t:600, on:"*", server:30} ;

The use of client-side caching is optional - you can use server-side caching by itself. Exceptions clear the cache.

Cache keys
----------
By default, the key used to cache results is based on all the arguments to the function, and the apiVersion number (if any). The key is generated by the prototype:

	ApiPublisher.protypetype.cacheObject = function(context) {
		return {args:obj.arguments,version:obj.request.apiVersion} ;
	}

The "context" parameter is generated from the proxyContext prototype as usual. The return from this function is hashed and used as the key into the cache. By overriding this prototype you can, for example, choose to make the key dependent on User Agent, IP, session or anything else. Be aware that each individual key will store the data returned by the call, and the total volume of data will quickly mount. Server-side caching is more appropriate for data that is expensive but common to clients.

IMPORTANT: Don't use server-side caching for highly secure, important or personal data. The cache key is derived from the cacheObject() call, and so the (unlikely) possibility exists that the local cache will re-present the results of a previous call even if the arguments to the call have changed. The hash key is based on the primitive values in the arguments, not any references.

Nested APIs
===========
An API can include another API, allowing for conditional nesting, for example:

	var userApi = {
		getUserName:async function(){ ... },
		changeUserName:async function(newName) { ... }
	} ;
	userApi.getUserName.clientInstance = [] ;
	var remoteUserApi = new ApiPublisher(userApi) ;

	myApi = {
		loginUser:async function(uid,pwd) { .... }
		userApi: async function() {
			if (request.session.user) {
				return remoteUserApi ;
			} else {
				return null ;
			}
		}
	} ;

	// This is important - nested APIs must be clieniInstances
	myApi.userApi = clientInstance = [] ;

In this example, if a call is made to "/myApi", the return API will contain a nest API iff. the request has been authenticated by some mechanism that has set a session. Without authenication, 
	"/myApi/userApi" responds with null
which can be tested in the client:

	api = await RemoteApi.load("/myApi") ;
	if (!api.userApi)
		alert("You need to login first") ;
	else {
		name = api.userApi.getUserName() ;
		alert("Hello "+name) ;
	}


