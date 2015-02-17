/* NPMs */
var nodent = require('nodent')() ;
global.Promise = global.Promise || nodent.Promise ;
var http = require('http') ;
var connect = require('connect');
var fs = require('fs');

var remoteApi = require('../index') ; // Change to "ApiPublisher" in release
var ApiPublisher = remoteApi.ApiPublisher ;

/* Our test API */
var testApi = require('./testapi') ;

var api = new ApiPublisher(testApi) ;

var app = connect()
	// Published APIs request arguments in a JSON-encioded body (in req.body)
	.use(connect.json())				

	// Remote APIs available under "/testapi", e.g. the descriptor is 
	// at "/testapi" and the "delay" function in "/testapi/delay"
	.use("/testapi",api)			
	
	// Give browser access to the remote API loader
	.use("/RemoteApi.js",remoteApi.sendRemoteApi)				
	
	// Parse & cache .njs files on demand (nothing to do with ApiPublisher, 
	// just a simple example of nodent compiled on the server for use in 
	// a browser
	.use(nodent.generateRequestHandler('./web',null,{enableCache:true,compiler:{es7:true,promises:true}}))
	
	// Static files for the web-browser test
	.use(connect.static('./web',{maxAge:0})); 	 

http.createServer(app).listen(1966) ;

console.log("Test server listening on port 1966. Now run\n\tnode client.js\nor goto http://localhost:1966/\n") ;

// Call the API locally to show it's the same on client & server
var log = console.log.bind(console) ;
console.log("Calling the async API locally, just for show") ;
testApi.delay(3000)(log,log) ;
