"use nodent-promise" ;

var ServerApi = require("../index").ServerApi ;

//Load the API
var api = await ServerApi.load("http://localhost:1966/testapi") ;

// Make a remote call & display the result.
console.log("Client delay() is:",JSON.stringify(await api.delay(100))) ;
console.log("Client always.hello() is:",JSON.stringify(await api.always.hello())) ;


