"use nodent" ;

var ServerApi = require("../index").ServerApi ;

//Load the API
api <<= ServerApi.load("http://localhost:1966/testapi") ;

// Make a remote call
result <<= api.delay(100) ;

// display the result.
console.log(JSON.stringify(result)) ;


