"use nodent-promise";

var ApiPublisher = remoteApi = require('../index').ApiPublisher ;

/*
 * "nodent" friendly setTimeout
 */

async function after(n) {
	setTimeout(function(){ async return },n) ;
}


/**
 * Define and export a test API. The only function is "delay" which artificially
 * return the difference between the expected and actual time after a specified period.
 * 
 * Any asynchronous operation could be substituted for the timeout - http, DB, whatever...
 */

var nested = new ApiPublisher({
	hello:async function() {
	    console.log("Remote client called 'nested.hello()'") ;
		return "I am nested" ;
	}
});


var api = {
	delay:async function(period) {
        console.log("Remote client called 'delay("+period+")'") ;
	    if (period <= 0) {
	        throw new Error("This is not a time machine") ;
	    }
		period = period || 1000 ;
		var result = {started:Date.now()} ;
		await after(period) ;
		result.finished = Date.now() ;
		result.flutter = (result.finished-result.started)-period ; 
		return result ;
	},
	client:async function(username) {
        console.log("Remote client called 'client("+username+")'") ;
		return username+" - don't waste bandwidth!" ;
	},
	// An example of a nested API
	always:async function() {
		return nested ;
	}
} ;

//Example of APIs that resolves WITHOUT a round-trip on the client 
api.client.clientInstance = ["Matt"] ;
api.always.clientInstance = [] ;
api.delay.ttl = { t:1, on:".", server:2 } ;
module.exports = api ;
