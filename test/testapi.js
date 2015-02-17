"use nodent-promise";

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
	}
} ;

//Example of an API that resolves WITHOUT a round-trip on the client 
api.client.clientInstance = ["Matt"] ;

module.exports = api ;
