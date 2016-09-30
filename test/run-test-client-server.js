var nodent = require('nodent')({log:function(){}}) ;
var http = require("http") ;

/* Start the server */
var spawn = require('child_process').spawn ;
var server = spawn('node', [__dirname+'/server.js']);
server.stdout.on('data', function (data) {
	console.log('SERVER: ' + data);
});
server.stderr.on('data', function (data) {
	console.log('SERVER(error): ' + data);
});
server.on('close', function (code) {
	console.log('Server process exited with code ' + code);
});

/* Wait a few seconds and start the client */
function testServer() {
	var ServerApi = require("../index").ServerApi ;
	
	//Here's a vanilla JS use case
	ServerApi.load("http://localhost:1966/testapi").then(function(api){
		api.delay(200).then(function(result){
			console.log("Client",JSON.stringify(result)) ;
		},function(result){
            console.log("Client(error)",JSON.stringify(result)) ;
		})
	}) ;
	
	//...and the simpler Nodent JS case
	require("./nodented.js") ;
}

setTimeout(testServer,2000);