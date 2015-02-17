"use nodent-promise" ;

var ServerApi = require("../index").ServerApi ;

//Load the API
var api = await ServerApi.load("http://localhost:1966/testapi") ;

// Make a remote call & display the result.
console.log("nodent:",JSON.stringify(await api.delay(100))) ;


