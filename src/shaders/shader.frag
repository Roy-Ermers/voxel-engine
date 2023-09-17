uniform sampler2D uTexture;
uniform vec3 uSunDirection;

varying vec3 vNormal;
varying vec2 vUV;

void main() {
    vec4 texColor = texture2D(uTexture, vUV);
    vec3 normal = normalize(vNormal);
    vec4 ambientLight = vec4(0.5, 0.5, 0.5, 1.0);
    float diffuse = max(dot(normal, uSunDirection), 0.0);

    gl_FragColor = texColor * (ambientLight + diffuse);
}