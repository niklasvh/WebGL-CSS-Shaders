/* (c) 2011 detunized (http://detunized.net) */

precision mediump float;

uniform vec2 u_textureSize;
uniform vec2 mouse;
uniform sampler2D u_texture;

uniform float amount;
uniform float radius;

varying vec2 v_texCoord;

void main()
{
	
	float hr = radius * sqrt(1.0 - ((radius - amount) / radius) * ((radius - amount) / radius));

	vec2 xy = v_texCoord - (mouse.xy / u_textureSize);
	float r = sqrt(xy.x * xy.x + xy.y * xy.y);
	vec2 new_xy = r < hr ? xy * (radius - amount) / sqrt(radius * radius - r * r) : xy;

	gl_FragColor = texture2D(u_texture, new_xy + (mouse.xy / u_textureSize) );
}