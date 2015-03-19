"use nodent-promise";

var ApiPublisher = remoteApi = require('../index').ApiPublisher ;

/*
 * "nodent" friendly setTimeout
 */

async function after(n) {
	setTimeout($return,n) ;
}


/**
 * Define and export a test API. The only function is "delay" which artificially
 * return the difference between the expected and actual time after a specified period.
 * 
 * Any asynchronous operation could be substituted for the timeout - http, DB, whatever...
 */

var nested = new ApiPublisher({
	hello:async function() {
		return "I am nested" ;
	}
});


var api = {
	delay:async function(period) {
		period = period || 1000 ;
		var result = {started:Date.now()} ;
		await after(period) ;
		result.finished = Date.now() ;
		result.flutter = (result.finished-result.started)-period ; 
		return result ;
	},
	client:async function(username) {
		return username+" - don't waste bandwidth!" ;
	},
	// An example of a nested API that is conditional (and loaded on every request)
	nested:async function(include) {
		return include?nested:null ;
	},
	// An example of a nested API this is static (i.e. loaded once)
	always:async function() {
		return nested ;
	}
} ;

//Example of APIs that resolves WITHOUT a round-trip on the client 
api.client.clientInstance = ["Matt"] ;
api.always.clientInstance = [] ;

module.exports = api ;
