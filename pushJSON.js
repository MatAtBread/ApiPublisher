/**
 * Serialize an object to JSON by pushing it to a writeable stream in little bits
 */

var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
var meta = {    // table of character substitutions
		'\b': '\\b',
		'\t': '\\t',
		'\n': '\\n',
		'\f': '\\f',
		'\r': '\\r',
		'"' : '\\"',
		'\\': '\\\\'
};

module.exports = function(out,obj,replacer,onComplete) {
//	The stringify method takes a value and an optional replacer, and an optional
//	space parameter, and returns a JSON text. The replacer can be a function
//	that can replace values, or an array of strings that will select the keys.
//	A default replacer method can be provided. Use of the space parameter can
//	produce text that is more easily readable.
	var enc = "utf8";

//	If there is a replacer, it must be a function or an array.
//	Otherwise, throw an error.
	var rep = replacer;
	if (rep==null) rep = function(k,v){return v;}
	else if (typeof rep === 'function'){}
	else if (Array.isArray(rep)) {
		rep = function() {
			// Do somethng with replacer
		}
	} else throw new Error("Replacer must be nullish, a function or an Array") ;

	function xform(parent,k,o) {
		if (o && typeof o === 'object' && typeof o.toJSON === 'function') {
			o = value.toJSON(k);
		}
		return rep.call(parent,k,o) ;
	}
	
	var stack = [] ;
	var next = null ;
	var index = 0 ;
	obj = {'':obj} ;
	function walk(parent,k) {
		obj = xform(parent,k,obj) ;
		if (obj==undefined) {
			next() ;
		} else if (obj==null) {
			out.write('null',enc,next);
		} else if (typeof obj === "string") {
			out.write(quote(obj),enc,next);
		} else if (typeof obj === "number") {
			out.write(isFinite(obj) ? String(obj) : 'null',enc,next);
		} else if (typeof obj === "boolean" || typeof obj === "null") {
			out.write(String(obj),enc,next);
		} else if (Array.isArray(obj)) {
			if (obj.length==0)
				out.write('[]',enc,next);
			else {
				// Save state
				stack.push({next:next,index:index,obj:obj}) ;
				
				out.write('[',enc);
				
				// Current obj
				index = 0 ;
				var p = obj ;
				obj = obj[index] ;
				next = function() {
					index += 1 ;
					var peek = stack[stack.length-1] ;
					if (index<peek.obj.length) {
						out.write(',');
						obj = peek.obj[index] ;
						return walk(peek.obj,index) ;
					} else {
						out.write(']');
						pop = stack.pop() ;
						obj = pop.obj ;
						index = pop.index ;
						next = pop.next ;
						return next && next() ;
					}
				}
				return walk(p,index) ;
			}
		} else {
			var keys = Object.keys(obj) ;
			if (!keys || !keys.length) {
				return out.write('{}',enc,next);
			}
			obj = {keys:keys,v:obj} ;
			// Save state
			stack.push({next:next,index:index,obj:obj}) ;
			
			// Current obj
			index = 0 ;
			if (obj.keys[index]!=="")
				out.write("{"+quote(obj.keys[index])+":",enc);
			var p = obj.v ;
			var k = obj.keys[index] ;
			obj = obj.v[k] ;
			next = function() {
				index += 1 ;
				var peek = stack[stack.length-1] ;
				if (index<peek.obj.keys.length) {
					out.write(", "+quote(peek.obj.keys[index])+":",enc);
					obj = peek.obj.v[peek.obj.keys[index]] ;
					return walk(peek.obj.v,peek.obj.keys[index]) ;
				} else {
					pop = stack.pop() ;
					obj = pop.obj ;
					index = pop.index ;
					next = pop.next ;
					if (next) {
						out.write('}');
						return next() ;
					}
					return onComplete && onComplete() ;
				}
			}
			return walk(p,k) ;
		}
	}
	debugger; 
	walk(obj,'') ;
};

function quote(string) {
//	If the string contains no control characters, no quote characters, and no
//	backslash characters, then we can safely slap some quotes around it.
//	Otherwise we must also replace the offending characters with safe escape
//	sequences.

	escapable.lastIndex = 0;
	return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
		var c = meta[a];
		return typeof c === 'string'
			? c
					: '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
	}) + '"' : '"' + string + '"';
}


