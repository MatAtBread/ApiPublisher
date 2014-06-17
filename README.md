ApiPublisher
============

ApiPublisher is a simple framework to extend asynchronous "funcback" signature calls across over HTTP. Tested clients exist for NodeJS and web-browsers, and a publisher (server) for NodeJS. The goal of ApiPublisher is provide an identical asynchronous API across clients and servers so that dependent routines can execute at any location without modification.

ApiPublisher works with Connect, Express and Nodent [https://www.npmjs.org/package/nodent] seamlessly.

ApiPublisher has been in use since November 2013 in production systems.

Installation
============

	npm install apipublisher

Usage
=====

ApiPublisher consists of three components. One to expose APIs from a nodejs server (ApiPublisher), one to call these APIs from another nodejs server (ServerApi) and one to call these APIs from a browser (RemoteApi).

All APIs must conform to the "funcback" pattern, where a function returns asynchronously by returning a function that accepts to callback arguments (one for the return value, one for exceptions). These have the calling signature of:

	myAsyncFunction(...arguments...)(function(success){
		// Handle "success" return
	},function(error){
		// Handle "error" exception
	})

These functions are typically declared as:

	function myAsyncFunction(...arguments...) {
		return function(success,error) {
			try {
				// Do something asynchronous
				return success(...result...) ;
			} catch(ex) {
				return error(ex) ;
			}
		}
	}

Using Nodent these can be called as:

	success <<= myAsyncFunction(...arguments...) ;

and declared as:

	async-function myAsyncFunction(...arguments...) {
		return success(...result...) ;
	}

Full details can be found at [https://www.npmjs.org/package/nodent]. Note the use of Nodent to generate funcback patterned calls is entirely optional. Within this README, Nodent is used in some of the examples for brevity.

Declaring an API for remoting
-----------------------------

Simply collect together the funcback calls in an object:

	var myAPI = {
		doSearch:async-function(term) {
			var result = {} ; 
			// search here
			return result ;
		},
		loginUser:async-function(uid,pwd) {
			// Examine user DB and generate session
			return sessionKey ;
		}
	} ;

This API can be called locally (of course), for example:

	results <<= myAPI.doSearch("Hello") ;

To expose the APIs in nodejs, create a new ApiPublisher from your object and server it from the URL of your choice.

	var ApiPublisher = require("apipublisher").ApiPublisher ; // Allow APIs to be exposed
		...
	var publishedApi = new ApiPublisher(myAPI) ;
		...
	var app = connect();	// This example uses Sencha Connect
	app.use(connect.json())	// Published APIs expect a JSON encoded request.body
		.use("/api", publishedApi)  ;
	
	// Iff we want to make the API available to browsers, also expose the RemoteApi script for them to load
	app.use("/js/RemoteApi.js", require("apipublisher").sendRemoteApi) ;
		...
	http.createServer(app).listen(7999);

This will expose the API at the URL "/api". Specifically, it will, in this case, handle incoming requests to "/api/doSearch" and "/api/loginUser", as defined by our API. Note that only functions are exported - if myAPI contained data or other members, these are currently ignored when the API is published.
		
Calling a remote API from nodejs
--------------------------------

To call a published API from node, require the ServerApi, and initialise it from the remote URI :

	var ServerApi = require("apipublisher").ServerApi ; // Allow APIs to be called
		...
	api <<= ServerApi.load("http://example.com/api") ;
		...
	// Call the API:
	user <<= api.loginUser("matt","atbread") ;
	if (user) {
		result <<= api.doSearch("Hello") ;
	}

Note the API is called with exactly the same syntax, semantics and parameters as if it had be called locally (see above).

Call a remote API from a browser
--------------------------------

On the server, you should expose "RemoteApi.js" from some path, or if preferred copy or symlink it from the package into your existing static web resources

On the client, you need to include that script, and then load the remote API as above. In the example below, we're assing the API exists on the same URI as the content files (HTML, JS).

	<script src="/js/RemoteApi.js"></script>
	<script>
		RemoteApi.load("/api")(function(api){
			window.api = api ; // Save the API for use later.
		},function(err){
			alert("Failed to load API: "+err.message) ;
		}) ;
			...
		document.getElementById("loginButton").onclick = function(){
			api.loginUser(userName,password)(function(done){
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
	api <<= RemoteApi.load("/api") ;
	window.api = api ;
		...
	document.getElementById("loginButton").onclick = function(){
		done <<= api.loginUser(userName,password) ;
		window.user = done ;
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

prototype.proxyContext(name,req,rsp)
------------------------------------
When reading and parsing a remote API request, prior to calling the specified function within the server, the "this" object is generated by this prototype. By default, the "this" has the original API collection as it's prototype, and is augmented with a member "request" that is set to the incoming request. Taking the "myApi" example above, if called from within the server directly, "this" (as usual) will be the object myApi. If called remotely, it will be an object whose prototype is "myApi" and with an additional member "request", for example:

	myApi.radius = new RadiusServer(....) ;
	
	myApi.loginUser = async-function(uid,pwd) {
		// "this" is "myApi", and it has an object called "radius" that is visible as usual
		user <<= this.radius.validateUser(uid,pwd) ; 
		// If remote, check the request's source IP
		if (this.request && !this.request.socket.remoteAddress.match(/192\./))
			throw new Error("Illegal login access attempt") ;
		return user ;
	}

Using this feature of the prototype.proxyContext allows you to test for session information, referrer, headers, etc. during the processing of remote calls. The default implementation is:

	ApiPublisher.prototype.proxyContext = function(name,req,rsp) {
		return Object.create(this.context,{ request:{value:req} }) ;
	};

Overriding this behaviour allows for other variables to take part in remote API request processing (e.g. closures or similar). Re-assign the member after creation:

	var httpServer = http.createServer(app) ;
	var publishedApi = new ApiPublisher(myAPI) ;
	// For our API, we want to expose the server too.
	publishedApi.proxyContext = function(name,req,rsp) {
		return Object.create(this.context,{ request:{value:req}, server:{value:httpServer} }) ;
	}

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

prototype.apiStart:function(path,name,args,data)
------------------------------------------------
Called before every remote API call is sent over the network. Useful for debugging and providing UI feedback that a network operation is underway.

prototype.apiEnd:function(path,name,args,data)
----------------------------------------------
Called after every remote API call has responded, but before the callee is called-back. Useful for debugging and providing UI feedback that a network operation has finished.

prototype.version
-----------------
See the section below on versioning

RemoteApi.load(url,options)
---------------------------
An optional "options" object can be used to override the prototypes at creation time, for example:

	myApi <<= RemoteApi.load("/api",{
		version:3,
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

	myApi.getUserName = async-function() {
		var user = readUserFromDB(this.request.session.uid) ;
		return user.firstName+" "+user.lastName ;
	}

Accessible (as usual) at "/api/getUserName".

We subsequently decide to provider a more detailed return:	

	myApi.getUserName = async-function() {
		var user = readUserFromDB(this.request.session.uid) ;
		return {name:user.firstName+" "+user.lastName,
			firstName:user.firstName,
			lastName:user.lastName} ;
	}

Clearly, this will break all existing clients which expect the old-style return. We can support both versions as follows:

	// "Latest" version
	myApi.getUserName = async-function() {
		var user = readUserFromDB(this.request.session.uid) ;
		return {name:user.firstName+" "+user.lastName,
			firstName:user.firstName,
			lastName:user.lastName} ;
	}

	// Old version:
	myApi.getUserName[1] = async-function() {
		user = this.getUserName() ;
		return user.firstName+" "+user.lastName ;	// Old style - just a string
	}

This versioned API will be accessible at "/api/getUserName/1". To support this from clients which do not update automatically (i.e. where the code has shipped and is fixed, such as mobile applications), a version can be passed to both ServerApi and RemoteApi within the URL:

	api <<= RemoteApi.load("http://example.com/api/1") ;

This "fixes" the API at version "1". Note: version numbers must be integers greater than zero.

"clientInstance"
================
Remote API calls that are "static", unchanging or fixed for a reasonable period of time (such as for the duration of a session) can have their results transported in the initial API call, rather than on every invokation. To acheive this, on the server side the API call should have a property called "clientInstance" set to the argument list suitable for the call. Continuing the example above:

	myApi.getUserName.clientInstance = [] ; // getUserName doesn't take any arguments

When the API is accessed via the URL "/api/getUserName", rather than transport the call information, the function is invoked directly and the result serialized instead, but is still callable from the client using the same API signature:

	name <<= api.getUserName() ;

	// or, using traditional Javascript
	api.getUserName()(function(name){ ... }) ;

These calls, although they look identical won't require a network round trip as they are sent in the inital API.

Nested APIs
===========
An API can include another API, allowing for conditional nesting, for example:

	var userApi = {
		getUserName:async-function(){ ... },
		changeUserName:async-function(newName) { ... }
	} ;
	userApi.getUserName.clientInstance = [] ;
	var remoteUserApi = new ApiPublisher(userApi) ;

	myApi = {
		loginUser:async-function(uid,pwd) { .... }
		userApi: async-function() {
			if (request.session.user) {
				return remoteUserApi ;
			} else {
				return null ;
			}
		}
	} ;

	myApi.userApi = clientInstance = [] ;

In this example, if a call is made to "/myApi", the return API will contain a nest API iff. the request has been authenticated by some mechanism that has set a session. Without authenication, 
	"/myApi/userApi" responds with null
which can be tested in the client:

	api <<= RemoteApi.load("/myApi") ;
	if (!api.userApi)
		alert("You need to login first") ;
	else {
		name = api.userApi.getUserName() ;
		alert("Hello "+name) ;
	}


