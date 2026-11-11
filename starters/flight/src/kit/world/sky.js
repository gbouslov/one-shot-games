import * as THREE from 'three';

/**
 * Sky dome for a low sun: zenith-to-horizon gradient, a warm band at the
 * horizon that is strongest toward the sun, the sun disc with a wide glow, a
 * layer of high streaked cloud lit from underneath on the sun side, and a
 * haze colour below the horizon that the fog matches.
 *
 * Written for this repository; the gradient-dome-with-sun-glow shape follows
 * the flight source's sky (see NOTICES.md).
 *
 *   const sky = createSky({ sunDir, zenith, horizon, glow, sun, haze, cloud })
 *   scene.add(sky.mesh); sky.update(camera, time)
 */
export function createSky({
  sunDir = [0.6, 0.16, -0.78],
  zenith = '#3d5f95',
  horizon = '#f2c99a',
  glow = '#ffb066',
  sun = '#fff1d6',
  haze = '#d9b08d',
  cloud = '#ffd9b0',
  cloudShadow = '#7d6f8c',
  cloudCover = 0.5,
  radius = 15000,
} = {}) {
  const uniforms = {
    uSun: { value: new THREE.Vector3(...sunDir).normalize() },
    uZenith: { value: new THREE.Color(zenith) },
    uHorizon: { value: new THREE.Color(horizon) },
    uGlow: { value: new THREE.Color(glow) },
    uSunColor: { value: new THREE.Color(sun) },
    uHaze: { value: new THREE.Color(haze) },
    uCloud: { value: new THREE.Color(cloud) },
    uCloudShadow: { value: new THREE.Color(cloudShadow) },
    uCover: { value: cloudCover },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uZenith, uHorizon, uGlow, uSunColor, uHaze, uCloud, uCloudShadow;
      uniform float uCover, uTime;
      varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=vnoise(p)*a; p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float mu = max(dot(d, uSun), 0.0);
        float y = d.y;
        // Gradient: a broad warm horizon band that thins toward the zenith.
        float t = pow(clamp(y, 0.0, 1.0), 0.45);
        vec3 col = mix(uHorizon, uZenith, t);
        // Warm the half of the sky the sun is in.
        float side = pow(mu, 3.0);
        col = mix(col, uGlow, side * (1.0 - t) * 0.85);
        // Sun disc and glow.
        col += uSunColor * (pow(mu, 1800.0) * 40.0 + pow(mu, 90.0) * 1.1 + pow(mu, 9.0) * 0.32);
        // High streaked cloud, projected onto a plane overhead.
        if (y > 0.015) {
          vec2 uv = d.xz / (y + 0.06) * 0.9;
          uv.x *= 0.45;
          float n = fbm(uv * 1.3 + vec2(uTime * 0.004, 0.0));
          float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.32, n) * smoothstep(0.015, 0.2, y);
          vec3 cc = mix(uCloudShadow, uCloud, 0.35 + 0.65 * pow(mu, 2.0));
          cc += uSunColor * pow(mu, 12.0) * 0.8;
          col = mix(col, cc, c * 0.8);
        }
        // Below the horizon: haze, the colour the fog fades to.
        col = mix(col, uHaze + uGlow * side * 0.35, smoothstep(0.02, -0.06, y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'sky';
  return {
    mesh,
    uniforms,
    update(camera, time) {
      mesh.position.copy(camera.position);
      uniforms.uTime.value = time;
    },
  };
}
