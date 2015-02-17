var nodent = require('nodent')() ;
var http = require("http") ;

var ServerApi = require("../index").ServerApi ;

// Here's a vanilla JS use case
ServerApi.load("http://localhost:1966/testapi").then(function(api){
	api.delay(200).then(function(result){
		console.log("JS Remote",JSON.stringify(result)) ;
	})
}) ;

//...and the simpler Nodent JS case
require("./nodented.js") ;
