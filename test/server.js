/* NPMs */
var nodent = require('nodent')() ;
var http = require('http') ;
var connect = require('connect');
var fs = require('fs');

var ApiPublisher = require('../index').ApiPublisher ;

/* Our test API */
var testApi = require('./testapi') ;

var api = new ApiPublisher(testApi) ;

var app = connect()
	// Published APIs request arguments in a JSON-encioded body (in req.body)
	.use(connect.json())				

	// Remote APIs available under "/testapi", e.g. the descriptor is 
	// at "/testapi" and the "delay" function in "/testapi/delay"
	.use("/testapi",api.handle())				
	
	// Parse & cache .njs files on demand (nothing to do with ApiPublisher, 
	// just a simple example of nodent compiled on the server for use in 
	// a browser
	.use(nodent.generateRequestHandler('./web',null,{enableCache:true}))
	
	// Static files for the web-browser test
	// RemoteApi.js (in ../www) should probably be copied/symlink'd in a real world example
	.use(connect.static('./web',{maxAge:0})) 	 
	.use(connect.static('../www',{maxAge:0})) ;	

http.createServer(app).listen(1966) ;

console.log("Test server listening on port 1966. Now run\n\tnode client.js\nor goto http://localhost:1966/\n") ;

// Call the API locally to show it's the same on client & server
var log = console.log.bind(console) ;
console.log("Calling the async API locally, just for show") ;
testApi.delay(3000)(log,log) ;
