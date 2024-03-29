/* NPMs */
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
	.use(connect.json({ strict: false }))				

	// Remote APIs available under "/testapi", e.g. the descriptor is 
	// at "/testapi" and the "delay" function in "/testapi/delay"
	.use("/testapi",api.handle)			
	
	// Give browser access to the remote API loader
	.use("/RemoteApi.js",remoteApi.sendRemoteApi)				
		
	// Static files for the web-browser test
	.use(connect.static(__dirname+'/web',{maxAge:0})); 	 

http.createServer(app).listen(1966) ;

console.log("Test server listening on http://localhost:1966/\n") ;

// Call the API locally to show it's the same on client & server
var log = console.log.bind(console) ;
console.log("Calling the async API locally, just for show") ;
testApi.delay(3000).then(log,log) ;
testApi.delay(3000).then(log,log) ;
testApi.delay(3000).then(log,log) ;
