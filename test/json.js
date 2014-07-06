var json = require('../pushJSON') ;

var $error = console.log.bind(console) ;
DEBUG = $error ; 
//var http = require('nodent')({use:['https']}).https ;
require('nodent')();
var URL = require('url') ;

var neo4j = require('swoon-neo4j') ;;

var devnull = {
		write:function(data,enc,done){ 
			done && process.nextTick(done); 
			return true;
		}
};

var strnull = {
		write:function(data,enc){ 
			return true;
		}
};

var out = process.stdout ;

function report() {
	for (var i=2; i<t.length; i+=2)
		console.log(t[i]+":\t"+(t[i+1]-t[i-1])) ;
}
var t = ["start",Date.now()] ;

neo4j.start({neo4jURI:"http://dev.favr.tt:7474"},"connect",{
	vmOptions:null,
	classpath:null,
	databaseProperties:null,
	serverProperties:null,
	haProperties:null
})(function(db){
	for (var n=0; n<1; n++) {
		db.cypher("match (u:User)-->(o:Offer) where has(u.id) return distinct o,count(u)")
		(function(d){
			t.push("rows "+d.length) ;
			t.push(Date.now()) ;
			json(out,d,null,function(){
				t.push("async") ;
				t.push(Date.now()) ;
				out.write(JSON.stringify(d),"utf8");//,function(){
					t.push("JSON") ;
					t.push(Date.now()) ;
					report() ;
				//}) ;
			}) ;
		},$error);
		t.push("start") ;
		t.push(Date.now()) ;
	}
},$error) ;
 
/*json(process.stdout,[123,"abc",{name:"xyz",age:987},456],null,function(){
	t.push("\nJSON") ;
	t.push(Date.now()) ;
	report() ;
}) ;*/
/*
var x = URL.parse("https://api.github.com/repos/joyent/node/issues?state=all&since=2000-01-01Z00:00:00") ;
x.headers = {'User-Agent':"Nodent", 'Accept':'application/json'} ;
http.getBody(x)(function(body){
	var d = JSON.parse(body) ;
	t.push("http:"+d.length) ;
	t.push(Date.now()) ;
	json(devnull,d,null,function(){
		t.push("async") ;
		t.push(Date.now()) ;
		devnull.write(JSON.stringify(d),"utf8",function(){
			t.push("JSON") ;
			t.push(Date.now()) ;
			report() ;
		}) ;
	}) ;
},$error) ;
*/