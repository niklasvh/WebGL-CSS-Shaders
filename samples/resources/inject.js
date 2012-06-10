/* 
* @author Niklas von Hertzen <niklas at hertzen.com>
* @created 2.6.2012 
* @website http://hertzen.com
 */

(function( d, w ){
    
    var scripts = ['jquery.min','gl-matrix','html2canvas','Tween','css-shaders'], i;
    
    for (i = 0; i < scripts.length; ++i) {
        d.write( '<script src="../../src/' + scripts[ i ] + '.js"></script>');
    }
    
    
     w.onload = function() {
       CSSshaders.init();  
     };
    
})( document, window )
