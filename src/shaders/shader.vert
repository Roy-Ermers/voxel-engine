varying vec3 vNormal;
varying vec2 vUV;

uniform float uTime;

void main() {
    vUV = uv;
    vNormal = vec3(normal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
