var fs = require("fs") ;
var ApiPublisher = require("./ApiPublisher") ;
var ServerApi = require("./ServerApi") ;
var remoteApiPath = __dirname+"/www/RemoteApi.js" ; 

var remoteApiContent ;

var bundledFunctions = {
    afn$memo:require('afn/memo')
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
