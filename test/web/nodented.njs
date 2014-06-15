(function(){

// Load the API
api <<= RemoteApi.load("/testapi") ;

// Save the API globally for playing with from the debug console
window.testapi = api ;

// Set the button's onclick handler to make a remote call
// and display the result.
document.getElementById("test").onclick = function() {
	result <<= api.delay(300) ;
	document.getElementById("flutter").innerText = "Flutter was "+result.flutter+" ms." ;
}

})() ;