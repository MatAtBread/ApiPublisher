ApiPublisher
============

ApiPublisher is a simple framnework to extend asynchronous func-back signiture calls across over HTTP. Tested clients exist for NodeJS and web-browsers, and a publisher (server) for NodeJS. The goal of ApiPublisher is provide an identical asynchronous API across clients and servers so that dependent routines can execute at any location without modification.

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

and declares as:

	async-function myAsyncFunction(...arguments...) {
		return success(...result...) ;
	}

Full details can be found at [https://www.npmjs.org/package/nodent]. Note the use of Nodent to generate func-back patterned calls is entirely optional. Within this README, Nodent is used for the example for brevity.

Declaring an API for remoting
-----------------------------

Simply collect together the func-back calls in an object:
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
	var ApiPublisher = require("ApiPublisher").ApiPublisher ; // Allow APIs to be exposed
		...
	var publishedApi = new ApiPublisher(myAPI) ;
		...
	var app = connect();	// This example uses Sencha Connect
	app.use(connect.json())	// Published APIs expect JSON encoded bodeis
		.use("/api", publishedApi)  ;
// Iff we want to make the API available to browsers, also expose the RemoteApi script for them to load
	app.use("/js/RemoteApi.js", require("ApiPublisher").sendRemoteApi) ;
		...
	http.createServer(app).listen(7999);

This will expose the API at the URL "/api". Specifically, it will, in this case, handle incoming requests to "/api/doSearch" and "/api/loginUser", as defined by our API. Note that only functions are exported - if myAPI contained data or other members, these are currently ignored when the API is published.
		
Calling a remote API from nodejs
--------------------------------

To call a published API from node, require the ServerApi, and initialise it from the remote URI :

	var ServerApi = require("ApiPublisher").ServerApi ; // Allow APIs to be called
		...
	api <<= ServerApi.load("http://example.com/api") ;
		...
	// Call the API:
	user <<= api.loginUser("matt","atbread") ;
	if (user) {
		result <<= api.doSearch("Hello") ;
	}

Note tha API is called with exactly the same syntax, semantics and parameters as if it had be called locally (see above).

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

A full example of a nodejs-based published API, API client and browser client can be in the /test directory of the ApiPublisher package. 

To start the API server:
	node server.js

To access the API from a nodejs client
	node client.js

To access the API from a browser, go to http://localhost:1966

The example shows both traditional Javascript (.js) and Nodent-transcoded Javascript (.njs) in the client

Advanced Usage
==============

ApiPublisher options and prototype
----------------------------------

ApiPublisher.prototype.proxyContext
ApiPublisher.prototype.serializer

ServerApi options and prototype
-------------------------------

ServerApi.prototype.onSuccess 
ServerApi.prototype.onError 
ServerApi.prototype.headers 
ServerApi.prototype.serializer 
ServerApi.prototype.reviver 

RemoteApi options and prototype
-------------------------------

RemoteApi.prototype.onSuccess:function(result){},
RemoteApi.prototype.onError:function(xhr){},
RemoteApi.prototype.apiStart:function(path,name,args,data){},
RemoteApi.prototype.apiEnd:function(path,name,args,data){},
RemoteApi.prototype.version:"",
RemoteApi.prototype.reviver:null,
RemoteApi.prototype.serializer:null,
RemoteApi.prototype.headers:null

Versioning
----------

"clientInstance"
----------------

Nested APIs
-----------


