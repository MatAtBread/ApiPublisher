/*
 * ApiPublisher - expose client and server interfaces to arbitrary
 * sets of async-functions (see https://www.npmjs.org/package/nodent)
 * with the general signature:
 * 		 function(....)(function(success){},function(error){}) ;
 *
 */

var ApiPublisher = require("./ApiPublisher") ;
var ServerApi = require("./ServerApi") ;

module.exports = {
	ApiPublisher:ApiPublisher,
	ServerApi:ServerApi
} ;
