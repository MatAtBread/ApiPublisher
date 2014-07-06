/**
 * Serialize an object to JSON by pushing it to a writeable stream in little bits
 */

module.exports = function(out,obj,replacer,onComplete) {
//	The stringify method takes a value and an optional replacer, and an optional
//	space parameter, and returns a JSON text. The replacer can be a function
//	that can replace values, or an array of strings that will select the keys.
//	A default replacer method can be provided. Use of the space parameter can
//	produce text that is more easily readable.
	var enc = "utf8";

	if (obj===undefined) 
		return "" ;
//	If there is a replacer, it must be a function or an array.
//	Otherwise, throw an error.

	var xform ;
	if (replacer==null) {
		xform = function(parent,k,o) {
			if (o && typeof o === 'object' && typeof o.toJSON === 'function') {
				o = value.toJSON(k);
			}
			return o ;
		}
	}else if (typeof replacer === 'function'){
		xform = function(parent,k,o) {
			if (o && typeof o === 'object' && typeof o.toJSON === 'function') {
				o = value.toJSON(k);
			}
			return replacer.call(parent,k,o) ;
		}
	} else if (Array.isArray(replacer)) {
		if (o && typeof o === 'object' && typeof o.toJSON === 'function') {
			o = value.toJSON(k);
		}
		// Do something with replacer
		//return replacer.call(parent,k,o) ;
		return o ;
	} else throw new Error("Replacer must be nullish, a function or an Array") ;

	var stack = [] ;
	var next = function(){ onComplete() };
	var index = 0 ;
	var sep ;
	
	function iter(fn) {
		return function() {
			while (fn = fn()) ;
		}
	}

	var yield = 0 ;
	function write(data,encoding,done) {
		if (done) {
			yield += 1 ;
			if (out.write(data,encoding)) {
				//if (yield&0x0FFF)
					return done ;
				//setImmediate(iter(done)) ;
				return ;
			}
			out.once('drain',iter(done)) ;
			return ;
		}
		out.write(data,encoding) ;
		return ;
	}

	function walk() {
		if (obj==null) {
			return write('null',enc,next);
		} else if (typeof obj !== "object" || obj instanceof Number) {
			//return write(JSON.stringify(obj),enc,next);
			return write(quote(obj.toString()),enc,next);
		} else if (Array.isArray(obj)) {
			if (obj.length==0)
				return write('[]',enc,next);
			else {
				// Save state
				stack.push({next:next,index:index,obj:obj}) ;

				// Current obj
				index = 0 ;
				function stepArray() {
					var peek = stack[stack.length-1] ;
					if (index<peek.obj.length) {
						obj = peek.obj[index] ;
						obj = xform(peek.obj,index,obj) ;
						index += 1 ;
						write(sep);
						sep = ", " ;
						return walk ;
					} else {
						write(']');
						var pop = stack.pop() ;
						obj = pop.obj ;
						index = pop.index ;
						next = pop.next ;
						return next ;
					}
				}
				sep = "[" ;
				next = stepArray ;
				return next ;
			}
		} else {
			var keys = Object.keys(obj) ;
			if (!keys || !keys.length) {
				return write('{}',enc,next);
			}
			obj = {keys:keys,v:obj} ;
			// Save state
			stack.push({next:next,index:index,obj:obj}) ;

			// Current obj
			index = 0 ;
			function stepObject() {
				var peek = stack[stack.length-1] ;
				if (index<peek.obj.keys.length) {
					var k2 = peek.obj.keys[index] ;
					obj = peek.obj.v[k2] ;
					obj = xform(peek.obj.v,k2,obj) ;
					index += 1 ;
					if (obj===undefined) {
						return next ;
					}
					write(sep+quote(k2)+":",enc);
					sep = ", " ;
					return walk ;
				} else {
					var pop = stack.pop() ;
					obj = pop.obj ;
					index = pop.index ;
					next = pop.next ;
					write('}');
					return next ;
				}
			}
			sep = "{" ;
			next = stepObject ;
			return next ;
		}
	}
	obj = xform(null,'',obj) ;
	iter(walk)() ;
};

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


