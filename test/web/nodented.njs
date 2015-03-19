(function(){

// Load the API
window.remote = await RemoteApi.load("/testapi") ;

// Set the button's onclick handler to make a remote call
// and display the result.
document.getElementById("test").onclick = function() {
	var result = await remote.delay(300) ;
	document.getElementById("flutter").innerText = "Flutter was "+result.flutter+" ms." ;
}

var greeting = await remote.always.hello() ; 
console.log(greeting) ;
if (greeting != "I am nested")
	alert("remote.always.hello failed");

//debugger ;
//var nested = await RemoteApi.load(remote.nested(1)) ;
//console.log(await nested.hello()) ;
})() ;