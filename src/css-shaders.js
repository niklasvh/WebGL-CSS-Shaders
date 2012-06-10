/* 
 * @author Niklas von Hertzen <niklas at hertzen.com>
 * @created 2.6.2012 
 * @website http://hertzen.com
 */


var CSSshaders = (function( window, d, mat4 ) {
    
    
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

    (function() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
            || window[vendors[x]+'CancelRequestAnimationFrame'];
        }
 
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() {
                    callback(currTime + timeToCall);
                }, 
                timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
 
        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
    }());
    
    
    // http://perfectionkills.com/detecting-event-support-without-browser-sniffing/
    function isMouseEventSupported( eventName ) {
        var el = d.createElement('div'),
        isSupported = (eventName in el);
        if ( !isSupported ) {
            el.setAttribute( eventName, 'return;' );
            isSupported = typeof el[eventName] == 'function';
        }
        el = null;
        return isSupported;
    }
    
    // animation handler, just to avoid updating frames if not necessary
    
    var Animations = (function(){
        
        var animate = function() {
            requestAnimationFrame( animate ); 
            if (typeof TWEEN !== "undefined") {
                TWEEN.update();
            }
            programs.forEach(function( program ){
                if ( program.running ) {
                    program.render();
                }
            });
            
            
        },
            
       
        programs = [];
        
        animate(); // start animation
        
        return {
            register: function( gl, mesh ) {
                var program = {
                    start: function() {
                        program.running = true;
                    },
                    running: false,
                    stop: function() {
                        program.running = false;
                    },
                    render: function() {
                        gl.drawArrays(gl.TRIANGLES, 0,  mesh[0] * mesh[1] * 6);
                    }   
                };
                
                programs.push( program );
                
                return program;
            }
        }
        
        
    })(),
    glName,
    registeredElements = [],
    support = {
        mouseenter: isMouseEventSupported( "onmouseenter" )
    },
    
    API = {
        
        init: function() {
                 
            // combine all styles into a string
            (function( link, styles ){
                var css = "",
                urls = [];
            
                $a( link ).forEach(function( item ){
                    urls.push(item.href)
                });
            
                // load external stylesheets
                loader(urls, function( content ) {
                    css += content.join("");
                });
            
                // combine inline styles
                $a( styles ).forEach(function( item ){
                    css += item.innerHTML;
                });
            
                // parse filter selectors
                var parsed = parseCSS(css),
                setupElements = [];
        
                // go through each selector which had a webkit-filter with custom() function, needs to be async
                
                parsed.forEach(function( data ){ 

                    if (data === undefined) return;  
                  
                    var element = d.querySelector( data.selector );
               
               
                    if (element !== null) {
                        // let's find out if we have some canvas created for the element already
                        if (!registeredElements.some(function( el ) {
                    
  
                            if (el.element === element) {
                        
                                // we have an element
                                // TODO: it could have its own shaders, but we are assuming its just property changes
                      
                                el.data.transition = (function( css ){
                                    function getVal( prop ) {
                                        var val;
                                
                                        ["","-webkit-","-moz-","-o-"].some(function( prefix ){              
                                            return (val = css.getPropertyValue( prefix + prop));      
                                        });
                                    
                                        return val;
                                    }
                                   
                                    return {
                                        property: getVal("transition-property"),
                                        func: getVal("transition-timing-function"),
                                        duration: (function( time ){
                                    
                                            var result = time.match(/([0-9]*\.?[0-9]*)(s|ms)/);
                                            if (result === null) return 1000;
                                   
                                            time = parseFloat( result[ 1 ] );
                                   
                                            if (result[ 2 ] === "s") {
                                                return time*1000;
                                            }
                                   
                                    
                                        })(getVal("transition-duration"))
                                    };
                                
                                })( window.getComputedStyle( element ) );
                               
                                el.data.hover = data.params;
                                el.data.hoverElement = d.querySelector( data.pseudoElement );
                       
                                return true;
                            } else {
                                return false;        
                            } 
                        })) {
                            // no element registered, create one
                            setupElements.push({
                                element:element,
                                data: data
                            });
                    
                            registeredElements.push( {
                                element:element,
                                data: data
                            } );
                    
                        }
                    
                    
                    }

   
            
                });
            
                setupElements.forEach(function( el ) {
                    API.add( el.element, el.data );
                });
            
            })( d.getElementsByTagName("link"), d.getElementsByTagName("style"));  
        },
        
        filter: function( css ) {
            
            var data = {
                fragmentShader: undefined,
                vertexShader: undefined,
                params: {},
                mesh: [1, 1]
            },

            // get the actual url from url() function or return undefined
            getURL = function( val ) {

                if ( val !== undefined && val !== "none") {
                    return /url\("?(.*)"?\)/.exec( val )[ 1 ];
                }
                return undefined;
            },
            // parse the value of css property passed in param
            getValue = function( val ) {
            
                // float
                if (val.split(" ").length === 1 && /^\d+$/.test( val )) {            
                    return parseFloat( val );
                }
            
                return val;
            };
            
            // loop through each property in custom()
            css.split(",").forEach(function( prop, i ){
                prop = prop.trim();
            
                // parse shader urls
                if ( i === 0 ) {
                    var shaderInfo = /(:?none|url\(.*?\))\s?(:?none|url\(.*\))?/.exec( prop );
                
                    data.vertexShader = getURL( shaderInfo[ 1 ] );
                    data.fragmentShader = getURL( shaderInfo[ 2 ] );
                    
          
                } else if ( i === 1 && /^\d/.test( prop )) {
                    // # segments  
                    // TODO add all filter types
                    var segments = /^(\d+)\s?(\d+)?\s?(filter-box|border-box)?\s?(detached)?$/.exec(prop);
                    
                    if (segments === null) return;
                   
                    data.mesh[ 0 ] = parseInt( segments[ 1 ] );
                
                    if ( segments[ 2 ] === undefined ) {
                        data.mesh[ 1 ] = data.mesh[ 0 ]; // x === y
                    } else {
                        data.mesh[ 1 ] = parseInt( segments[ 2 ], 10 );
                    }
                
                
                } else {
                    // custom params
                
              
                
                    var customParam = /(\w+)\s(.*)/.exec( prop );
                    data.params[ customParam[ 1 ] ] =  (function( value ){
                        var type,
                        matched,
                        a,
                        re = /(matrix3d|rotateX|rotateY|rotateZ|scale)\((-?[0-9]*\.?[0-9]+)(deg)?\)/;
                        
                        // 3d transforms
                        if ((matched = value.toString().match(re) ) !== null) {
                            
                            // create a standard "empty" transformation matrix
                            var matrix = [
                            1, 0, 0, 0,
                            0, 1, 0, 0,
                            0, 0, 1, 0,
                            0, 0, 0, 1
                            ];
                            
                            // loop through each transform
                            value.split(/\s/g).forEach(function( transform ){
                                var result = re.exec(transform);
                               
                                // no match, skip to next property
                                if (result === null) return;
                               
                                switch ( result[ 1 ] ) {
                                    
                                    // 3d rotations
                                    case "rotateX":
                                    case "rotateY":
                                    case "rotateZ":
                                        
                                        mat4[result[ 1 ]]( matrix,  degToRad( result[ 2 ] ), matrix ); 
                                        break; 
                                    
                                    // scaling vec3
                                    case "scale":
                                        mat4[result[ 1 ]]( matrix, [ result[ 2 ], result[ 2 ], result[ 2 ] ], matrix );
                                        break;
                                        
                                }
                               
                            });

                            value = matrix;
                           
                        }
                        
                        
                        if ( typeof value === "object" ) {
             
                            switch ( value.length ) {
                                case 16:
                                    type = "uniformMatrix4fv";
                                    break;
                            }
                
                        } else if ( typeof value === "number" || /^-?[0-9]*\.?[0-9]+$/.test(value) ) {
                            value = parseFloat(value);
                            type = "uniform1f";
                        }
                            
                        return {
                            value: value,
                            type: type
                        };
                            
                    })( getValue( customParam[ 2 ] ) );




                }
            
            
            });
            
            return data;
            
        },
        
        add: function( element, data ) {
            
         
            var canvas = d.createElement("canvas"),
            render,
            gl = canvas.getContext( glName, { 
                antialias: true,
                alpha: true,
                depth: true
            }), methods = {
                state: function( params ) {
                    
                    params = (typeof params === "string") ? API.filter( params ).params : params;
                    
                    // create a tween object for the properties of this element          
                    var tween = createTween( gl, data.params, params, data.transition).start(),
                    forward = true;
                    
                    return {
                        enable: function() {
                            forward = true;
                            tween.reverse( false ).play();  
                        },
                        disable: function() {
                            forward = false;
                            tween.reverse().play();  
                        },
                        toggle: function() {
                                       
                            tween.reverse( !forward ).play();                   
                            forward = !forward;
                            
                        }
                    }
                    
                },
                transition: function( duration, func) {
                    data.transition = {
                        duration: duration,
                        func: func
                    };
  
                    return methods;
                },
                hover: function( params, hoverElement) {
       
                    var state = methods.state( params ),
                    mouseenter = function() {    
                        state.enable();
                    }, mouseleave = function() {
                        state.disable();
                    };  
                    
                    hoverElement = ( hoverElement === undefined ) ? element : hoverElement;
                        
                    
                    // we'd really wanna use mouseenter/mouseleave here,
                    // but webkit has no support for it https://bugs.webkit.org/show_bug.cgi?id=18930
                                  
                    if ( support.mouseenter ) {
                      
                        hoverElement.addEventListener("mouseenter", mouseenter, false);
                        hoverElement.addEventListener("mouseleave", mouseleave, false);
                        
                    } else {
                        
                        var inside = false,
                        timer;
                        
                        hoverElement.addEventListener("mouseover", function() {
                            if ( !inside ) {
                                mouseenter();
                                inside = !inside;
                            }
                            window.clearTimeout( timer );
                        }, false);
                        
                        hoverElement.addEventListener("mouseout", function( el ) {
                            if ( inside ) {
                                timer = window.setTimeout(function() {
                                    mouseleave();
                                    inside = !inside;
                                }, 10);                   
                            }
                        }, false);
                        
                    }       
                            
                    
                                
                                
                        
            
                }
            };
       
                    
            element = (typeof element === "string") ? d.querySelector( element ) : element;
            data = (typeof data === "string") ? API.filter( data ) : data;
            
            
                
            html2canvas( [ element ], {
                taintTest: true,
                useCORS: false,
                onrendered: function( image ) {
                   
                    var bounds = element.getBoundingClientRect(),
                    toLoad = [];
                    
                    // setup canvas sizes
                    gl.viewportWidth = canvas.width = image.width;
                    gl.viewportHeight = canvas.height = image.height;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                
                
                
                    canvas.style.position = "absolute";
                    canvas.style.pointerEvents = "none";
                
                    // place webgl canvas ontop of real element
                   
                    canvas.style.top = bounds.top + "px";
                    canvas.style.left = bounds.left + "px";
                
                    element.style.opacity = 0; // hide real element
                
                    // load shader files
                            
                    if (data.vertexShader !== undefined) toLoad.push( data.vertexShader );
                    if (data.fragmentShader !== undefined) toLoad.push( data.fragmentShader );
                            
                         
                       
                    loader( toLoad, function( loaded ){
                          
                        // console.log(data);
                        // init shaders                
                        applyShader( gl, image, (data.vertexShader === undefined) ? undefined : loaded[ 0 ], (data.fragmentShader === undefined ) ? undefined : (data.vertexShader === undefined) ? loaded[ 0 ] : loaded[ 1 ], data.mesh, data.params, element );
                        
                        // register the gl
                        render = Animations.register( gl, data.mesh );
                        
                        if ( data.hover !== undefined ) {
                            methods.hover( data.hover, data.hoverElement );
                        }
               
                        
                        render.start();
                               
                        // throw canvas into DOM
                        d.body.appendChild( canvas );
                        
                    });
                
                        
                }
            });
                    
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.enable(gl.DEPTH_TEST);
            
            return methods;
        }
    };
    
    function createTween( gl, startParams, endParams, timing) {
        return new TWEEN.Tween( tweenObj( startParams ) )
        .to(tweenObj( endParams ), timing.duration)
        .easing( (function( func ){
            // define easing function
            // TODO add all
            switch( func ) {
                                        
                case "linear":
                case "cubic-bezier(0, 0, 1, 1)":
                    return TWEEN.Easing.Linear.None;
                    break;
                                        
                                        
                case "ease-in-out":
                case "cubic-bezier(0.42, 0, 0.58, 1)":
                    return TWEEN.Easing.Cubic.InOut;
                    break;
            }
                                    
        })( timing.func ) ).onUpdate( function () {
            var val = this;
            // update each CSS property into shader attributes
            Object.keys( startParams ).forEach(function( prop ) {
                                        
                if (gl, startParams[ prop ].type ===  "uniformMatrix4fv") {
                    // rebuild the array
                    var arr = [], i;
                    for ( i = 0; i < 16; i++ ) {
                        arr[ i ] = val[ "$" + prop + i ];
                    }
                                            
                    setAttrib( gl, startParams[ prop ], arr ); 
                                            
                } else {
                                            
                    setAttrib( gl, startParams[ prop ], val[ prop ] ); 
                }
                                        
            });
        } );
    }
    
    
    // convert degrees to radians
    function degToRad( deg ) {
        return deg * (Math.PI / 180);
    }
    
    // arrafy a array-like object
    function $a( arr ) {
        return Array.prototype.slice.call( arr );
    }
    
    // regexp to find and parse filters from css
    
    function parseCSS( css ) {
        
        
        /* 
         .something {
          anything: something;
          -webkit-filter: custom(none url(shaders/grayscale.fs), amount 0);
          optional: whatever;
        }
         */
        var globalData = [];
        
        // var selectors = /([^{;]+)(\{[^}]+\})/gi.exec( css.replace(/\n/gi,"").trim() );
        
        var selectors = css.replace(/\n/gi,"").trim().match(/([^{;]+)(\{[^}]+\})/gi);
        selectors.forEach(function(selector){
          
            
        
            // regexp to match selectors with filter's with custom() function ^(?:(?:.|\s)*)?
            var result = /(.*?)(?={.*?(?:\-webkit\-)?filter:\s?custom\((.*?)\);.*?})/gi.exec( selector );
        
            if (result === null) return;
            
            // TODO: currently assuming selector is for single element
            var element = result[ 1 ].trim(),
            hoverElementInfo = /(.*?):hover(.*)?/.exec( element ),
            hoverElement,
            data = API.filter( result[ 2 ] );
            
            if ( hoverElementInfo !== null ) {
                hoverElement = hoverElementInfo[ 1 ];
                element = element.replace(/:hover/g,"");
            }

            data.selector = element;
            data.pseudoElement  = hoverElement;
            
            
            globalData.push( data );
        });
        
        return globalData;
    }
    
    // create obj with values for Tween.js to update
    function tweenObj( data ) {
        var obj = {};
        
        Object.keys( data ).forEach(function( prop ){
            
            if (data[ prop ].value instanceof Array) {
                // Tween.js incapable of handling matrix arrays
                
                data[ prop ].value.forEach(function( val, index ) {
                    obj[ "$" + prop + index ] = val;
                });
                     
            } else {
                obj[ prop ] = data[ prop ].value;    
            }
                   
        });
        return obj;
    }
    

    
    
    function WebGLInit() {
        
        var canvas = d.createElement("canvas"),
        render,
        gl = (function( types ){
            var gl, i, len = types.length;
            
            for (i = 0; i < len; i++) {
                try {  
                    // get webgl context    
                    gl = canvas.getContext( types[ i ], { 
                        antialias: true,
                        alpha: true,
                        depth: true
                    } );
                    
                }  
                catch(e) {}  
                if ( gl ) {
                    glName = types[ i ];
                    return gl;
                }
            }
            
        })( ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"] );
        
        // no webgl support, bye bye
        if (!gl) {   
            return;  
        }  
       
        gl = undefined;
        
      
        
        
  


        
   
    }
    
    function loader( urls, callback ) {
   
        var num = urls.length,
        count = 0,
        data = [];
        

        urls.forEach(function( e, i ) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', e, true);

            xhr.onload = function(e) {
                count++;
                
                if (this.status == 200) {
                    data[ i ] = this.response;                
                }
                
                if ( num >= count ) {
                    callback( data );    
                }
            };

            xhr.send();   
        });
        
    }
    
    function createShader( gl, type, src ) {
        var shader = gl.createShader( type );
        gl.shaderSource( shader, src );
        gl.compileShader( shader );
        
        if ( !gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
            console.log( gl.getShaderInfoLog(shader) );
            return null;
        }
        
        return shader;
    }

    
    function setAttrib( gl, attrib, val) {
        switch ( attrib.type ) {
            case "uniformMatrix4fv":
                gl.uniformMatrix4fv( attrib.location, false, val || attrib.value );
                break;
                
            case "uniform1f":
                gl.uniform1f( attrib.location, val || attrib.value );
                break;
            
        }
    }
    
    function createVerts( segmentY, segmentX, start, end ) {
        
        segmentX = segmentX || 1;
        segmentY = segmentY || 1;
        
        var segW = (1/ segmentX),
        segH = (1 / segmentY),
        verts = [],
        posX,
        posY = end || 0;
        
        for (var y = 1; y <= segmentY; y++) {
            posX = start || 0;
            for (var x = 1; x <= segmentX; x++) {
               
                verts.push( 
                    posX,  posY,  
                    posX + segW,  posY,  
                    posX + segW,  posY + segH,
                    posX,  posY,  
                    posX + segW,  posY + segH,
                    posX,  posY + segH 
                    );
               
                posX += segW;
            
            }
            posY += segH;
        }
        return new Float32Array( verts );
    }

    function meshCoords( gl, meshCoordLocation, segmentX, segmentY) {
        
        var meshCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, meshCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, createVerts( segmentX, segmentY ), gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(meshCoordLocation);
        gl.vertexAttribPointer(meshCoordLocation, 2, gl.FLOAT, false, 0, 0);
 
    }
    
    function triangleCoords( gl, triangleCoordLocation, segmentX, segmentY) {
        
        var y,
        verts = [],
        x;
       
        
        for (y = 0; y < segmentY; y++) {

            for (x = segmentX; x > 0; x--) {
                verts.push(
                    x, y, 0, // top left
                    x, y, 1, // top right
                    x, y, 2, // bottom right
                    x, y, 3, // top left
                    x, y, 4, // bottom right
                    x, y, 5 // bottom left
                    );
            }
        }
        
        
        
        var triangleCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangleCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array( verts ), gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(triangleCoordLocation);
        gl.vertexAttribPointer(triangleCoordLocation, 3, gl.FLOAT, false, 0, 0);   
        
    }
 
    
    function bindTexture( gl, texture, texCoordLocation, segmentX, segmentY ) {
        
        var texCoordBuffer = gl.createBuffer(),
        canvasTexture = gl.createTexture();
        
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        
        
        
        gl.bufferData(gl.ARRAY_BUFFER, createVerts( segmentX, segmentY ), gl.STATIC_DRAW);
        

        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        
        
        gl.bindTexture(gl.TEXTURE_2D, canvasTexture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
        
         
    }

    
    function applyShader( gl, texture, vertexShader, fragmentShader, vertexMesh, params, el ) {
        
        var shaderProgram = gl.createProgram(),
        pos,
        projectionMatrix = mat4.ortho(-0.5, 0.5, 0.5, -0.5, -1, 1);
        

        // default shaders
        // https://dvcs.w3.org/hg/FXTF/raw-file/tip/custom/index.html#default-shaders
        if ( vertexShader === undefined ) {
            
            vertexShader =  [
            "precision mediump float;", // not in spec    
            "attribute vec4 a_position;",
            "attribute vec2 a_texCoord;",

            "uniform mat4 u_projectionMatrix;",

            "varying vec2 v_texCoord;",

            "void main() ",
            "{",          
            "    v_texCoord = a_texCoord;",
            "    gl_Position = u_projectionMatrix *  a_position;",
            "}"
            ].join("\n");
    
        } else {
            
            // check that necessary attributes are defined
            pos = vertexShader.indexOf("void main()");
            var inside = vertexShader.indexOf("{", pos) + 1;
            
            if (vertexShader.indexOf("v_texCoord = a_texCoord") === -1) {
                vertexShader = vertexShader.substr(0, inside) + "v_texCoord = a_texCoord;\n" + vertexShader.substr( inside );
            }
            
            if (vertexShader.indexOf("varying vec2 v_texCoord") === -1) {
                vertexShader = vertexShader.substr(0, pos) + "varying vec2 v_texCoord;\n" + vertexShader.substr( pos );
            }
            
            
        }
       
       
       
        // default fragment shader
        if ( fragmentShader === undefined ) {
            
            fragmentShader = [
            "precision mediump float;", // not in spec
            "varying vec2 v_texCoord;",
            "uniform sampler2D u_texture;",
            
            "void main()", 
            "{",
            "    gl_FragColor = texture2D(u_texture, v_texCoord);",
            "}"
            ].join("\n");
                
        } else {
            
            /* fragment shaders in CSS shaders differ from standard webgl fragment shaders, as you don't have access to pixel colors 
         * and instead need to perform the actions through color transforms: 
         * css_ColorMatrix - mat4
         * css_BlendColor - vec4
         */
            
            pos = fragmentShader.indexOf("void main()");
            
            if (fragmentShader.indexOf("uniform sampler2D u_texture") === -1) {
                fragmentShader = fragmentShader.substr(0, pos) + "uniform sampler2D u_texture;\n" + fragmentShader.substr( pos );
            }
            if (fragmentShader.indexOf("varying vec2 v_texCoord") === -1) {
                fragmentShader = fragmentShader.substr(0, pos) + "varying vec2 v_texCoord;\n" + fragmentShader.substr( pos );
            }
            
            if ( fragmentShader.indexOf("css_ColorMatrix") !== -1 ) {
                fragmentShader = fragmentShader.replace(new RegExp("css_ColorMatrix ="), "gl_FragColor = texture2D(u_texture, v_texCoord) *");  
            }
           
            if ( fragmentShader.indexOf("css_BlendColor") !== -1 ) {
                fragmentShader = fragmentShader.replace(new RegExp("css_BlendColor ="), "gl_FragColor = texture2D(u_texture, v_texCoord) *");  
            }
        }

  
        // compile & attach shaders
        gl.attachShader( shaderProgram, createShader( gl, gl.VERTEX_SHADER, vertexShader) );
        gl.attachShader( shaderProgram, createShader( gl, gl.FRAGMENT_SHADER, fragmentShader) );
         
        gl.linkProgram( shaderProgram );
        
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.log(gl.getProgramInfoLog(shaderProgram) );
        }
        
        gl.useProgram(shaderProgram);  
        
     
        
        /* bind variables
         vertex attributes
         https://dvcs.w3.org/hg/FXTF/raw-file/tip/custom/index.html#vertex-attribute-variables
     */
        
        
        /* attribute vec4 a_position
         The vertex coordinates in the filter region box. 
         Coordinates are normalized to the [-0.5, 0.5] range along the x, y and z axis.
        */
        var positionLocation = gl.getAttribLocation( shaderProgram, "a_position"),
        /* attribute vec2 a_texCoord;
         The vertex's texture coordinate. 
         Coordinates are in the [0, 1] range on both axis
        */
        texCoordLocation = gl.getAttribLocation( shaderProgram, "a_texCoord" );
        bindTexture( gl, texture, texCoordLocation,  vertexMesh[0], vertexMesh[1] );
        
        
        /* attribute vec2 a_meshCoord;
         The vertex's coordinate in the mesh box. 
         Coordinates are in the [0, 1] range on both axis.  
        */   
        if (vertexShader.indexOf("a_meshCoord") !== -1) {
            // meshCoords in use, so let's supply them
            var meshCoordLocation = gl.getAttribLocation( shaderProgram, "a_meshCoord");
            meshCoords( gl, meshCoordLocation, vertexMesh[0], vertexMesh[1]);
        }
        
        /* attribute vec3 a_triangleCoord;
         
        */
        if (vertexShader.indexOf("a_triangleCoord") !== -1) {
            // meshCoords in use, so let's supply them
            var triangleCoordLocation = gl.getAttribLocation( shaderProgram, "a_triangleCoord");
            triangleCoords( gl, triangleCoordLocation, vertexMesh[0], vertexMesh[1]);
        }       
        
        
        if (fragmentShader.indexOf("uniform vec2 mouse") !== -1) {
            // mouse coords in use, so let's supply them
         
            
            var mouseLocation = gl.getUniformLocation(shaderProgram, "mouse");
            
            gl.uniform2f( mouseLocation, 0, 0 );
            el.addEventListener("mousemove", function(e) {
                gl.uniform2f( mouseLocation, e.layerX, e.layerY );
                
            }, false);
        }  
        
     

        


        /* uniform variables
         https://dvcs.w3.org/hg/FXTF/raw-file/tip/custom/index.html#shader-uniform-variables
     */

        gl.uniform1i(gl.getUniformLocation(shaderProgram, "u_texture"), 0);
        gl.uniform2f( gl.getUniformLocation(shaderProgram, "u_textureSize"), texture.width, texture.height );
        gl.uniformMatrix4fv( gl.getUniformLocation(shaderProgram, "u_projectionMatrix"), false, projectionMatrix );
        
        gl.uniform2f( gl.getUniformLocation(shaderProgram, "u_meshSize"), vertexMesh[0], vertexMesh[1] );
        
        
        // custom CSS variables
        for ( var param in params ) {
            params[ param ].location = gl.getUniformLocation(shaderProgram, param);      
            setAttrib( gl, params[ param ] );   
        }
        
        
        
        // Create a buffer for the position of the rectangle corners.
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

       
       
        gl.bufferData(gl.ARRAY_BUFFER, createVerts( vertexMesh[0], vertexMesh[1], -0.5, -0.5 ), gl.STATIC_DRAW);
        

     
        
    }
         

    d.addEventListener('DOMContentLoaded', function() {
        console.log('start');
        WebGLInit(); 
    });
    
    return API;
    
})( window, document, mat4 );