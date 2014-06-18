/*
 * ApiPublisher - expose client and server interfaces to arbitrary
 * sets of async-functions (see https://www.npmjs.org/package/nodent)
 * with the general signature:
 * 		 function(....)(function(success){},function(error){}) ;
 *
 */

var fs = require("fs") ;

var ApiPublisher = require("./ApiPublisher") ;
var ServerApi = require("./ServerApi") ;
var remoteApiPath = __dirname+"/www/RemoteApi.js" ; 

var remoteApiContent ;

function sendRemoteApi(req,res,next) {
    res.writeHead(200, {'Content-Type': 'application/javascript'} );
    if (!remoteApiContent) {
    	remoteApiContent = fs.readFileSync(remoteApiPath) ;
    }
    res.end(remoteApiContent) ;
}


module.exports = {
	ApiPublisher:ApiPublisher,
	ServerApi:ServerApi,
	sendRemoteApi:sendRemoteApi,
	remoteApiPath:remoteApiPath
} ;
