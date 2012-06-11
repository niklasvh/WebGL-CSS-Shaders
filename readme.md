**CSS Shaders through WebGL**

For more information and demos, please read the introduction <a href="http://experiments.hertzen.com/css-shaders/index.html">here</a>.

**Usage**

To have the script parse all the CSS automatically (very experimental), just call:

`CSSshaders.init();`

To manually add a shader:

`CSSshaders.add( element, shaderParameters );` - returns shader element

Example:

`CSSshaders.add( "#content","url(shaders/flag.vs) url(shaders/grayscale.fs), 20 20, phase 50.0, amplitude 100.0, txf rotateX(45deg), amount 1")`

Shader element methods:

 - `transition( duration, function);` - adds transition with specified duration and function, returns *Shader element*
 - `state( shaderParameters );` - creates CSS state with specified parameters, returns *Shader state*

Shader state methods:
 - `enable()` - enable state
 - `disable()` - disable state
 - `toggle()` - toggle state

