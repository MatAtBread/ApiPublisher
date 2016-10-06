/*
 * ApiPublisher - expose client and server interfaces to arbitrary
 * sets of async-functions (see https://www.npmjs.org/package/nodent)
 * with the general signature:
 * 		 function(....).then(function(success){},function(error){}) ;
 *
 */

var fs = require("fs") ;
var nodent = require('nodent');
var ApiPublisher = require("./ApiPublisher") ;
var ServerApi = require("./ServerApi") ;
var remoteApiPath = __dirname+"/www/RemoteApi.js" ; 

var remoteApiContent ;

var bundledFunctions = {
    $asyncbind:nodent.$asyncbind,
    $asyncspawn:nodent.$asyncspawn,
    afn$memo:require('afn/dist/memo')
};

function sendRemoteApi(req,res,next) {
    res.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8'} );
    if (!remoteApiContent) {
    	remoteApiContent = fs.readFileSync(remoteApiPath).toString() ;
    	remoteApiContent = remoteApiContent.split(/<@|@>/).map(function(f,i){ return i&1?bundledFunctions[f].toString():f}).join("") ;
    }
    res.end(remoteApiContent) ;
}


module.exports = {
	ApiPublisher:ApiPublisher,
	ServerApi:ServerApi,
	sendRemoteApi:sendRemoteApi,
	remoteApiPath:remoteApiPath
} ;
