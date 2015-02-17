(function(){

// Load the API
window.api = await RemoteApi.load("/testapi") ;

// Set the button's onclick handler to make a remote call
// and display the result.
document.getElementById("test").onclick = function() {
	var result = await api.delay(300) ;
	document.getElementById("flutter").innerText = "Flutter was "+result.flutter+" ms." ;
}

})() ;