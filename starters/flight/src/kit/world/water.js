import * as THREE from 'three';

/**
 * Sea for an aerial game, in one cheap pass with no reflection render:
 *  - depth from the terrain height texture: turquoise shallows around every
 *    island, deep water further out, a breaking foam line at the shore
 *  - layered wave normals (six directional waves plus fine noise) that fade
 *    with distance so the far sea does not shimmer
 *  - Fresnel reflection of an analytic sky (same colours as createSky)
 *  - sun glitter: a tight HDR highlight (sparkles, picked up by bloom) over a
 *    broad warm path on the water toward a low sun
 *  - three's own fog, so the sea hazes out with the land
 *
 * Written for this repository.
 *
 *   const water = createWater({ heightTex, size, range, sunDir, colours... })
 *   scene.add(water.mesh); water.update(time)
 */
export function createWater({
  heightTex,
  size = 7000,
  range = 40,
  sunDir = [0.6, 0.16, -0.78],
  deep = '#0e3a52',
  shallow = '#2aa7a4',
  sand = '#c8b88f',
  foam = '#fff4e6',
  zenith = '#3d5f95',
  horizon = '#f2c99a',
  glow = '#ffb066',
  sun = '#fff1d6',
  extent = 60000,
  sparkle = 1,
} = {}) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uHeight: { value: heightTex },
      uSize: { value: size },
      uRange: { value: range },
      uSun: { value: new THREE.Vector3(...sunDir).normalize() },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uSand: { value: new THREE.Color(sand) },
      uFoam: { value: new THREE.Color(foam) },
      uZenith: { value: new THREE.Color(zenith) },
      uHorizon: { value: new THREE.Color(horizon) },
      uGlow: { value: new THREE.Color(glow) },
      uSunColor: { value: new THREE.Color(sun) },
      uSparkle: { value: sparkle },
    },
  ]);
  uniforms.uHeight.value = heightTex;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime, uSize, uRange, uSparkle;
      uniform sampler2D uHeight;
      uniform vec3 uSun, uDeep, uShallow, uSand, uFoam, uZenith, uHorizon, uGlow, uSunColor;
      varying vec3 vWorld;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
      }
      float gPx;  // world metres covered by one pixel here
      vec2 wave(vec2 p, vec2 dir, float len, float amp, float spd) {
        float k = 6.2831853 / len;
        float ph = dot(dir, p) * k + uTime * spd * sqrt(9.8 * k);
        // Fade a wave out before it is shorter than a few pixels: no moire.
        float aa = 1.0 - smoothstep(len * 0.12, len * 0.35, gPx);
        return dir * (amp * k * cos(ph)) * aa;
      }
      vec3 skyColor(vec3 r) {
        float mu = max(dot(r, uSun), 0.0);
        float t = pow(clamp(r.y, 0.0, 1.0), 0.45);
        vec3 c = mix(uHorizon, uZenith, t);
        c = mix(c, uGlow, pow(mu, 3.0) * (1.0 - t) * 0.85);
        return c;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec2 fw = fwidth(p);
        gPx = max(fw.x, fw.y);
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float fine = 1.0 - smoothstep(250.0, 1400.0, dist);
        float mid = 1.0 - smoothstep(1200.0, 6000.0, dist);

        vec2 g = vec2(0.0);
        // Swell modulated by slow noise, so no wave train reads as regular stripes.
        float swellMod = 0.35 + 0.9 * vnoise(p * 0.012 + vec2(uTime * 0.01, 0.0));
        g += wave(p, normalize(vec2(0.8, 0.6)), 71.0, 0.3, 1.0) * mid * swellMod;
        g += wave(p, normalize(vec2(-0.3, 0.95)), 37.0, 0.2, 1.0) * mid * (1.25 - swellMod * 0.6);
        g += wave(p, normalize(vec2(0.95, -0.2)), 19.0, 0.09, 1.0) * swellMod;
        // Irregular chop at two scales.
        vec2 q2 = p * 0.045 + vec2(-uTime * 0.05, uTime * 0.03);
        float m0 = vnoise(q2);
        float aa2 = 1.0 - smoothstep(4.0, 9.0, gPx);
        g += vec2(vnoise(q2 + vec2(0.5, 0.0)) - m0, vnoise(q2 + vec2(0.0, 0.5)) - m0) * 0.5 * aa2;
        g += wave(p, normalize(vec2(-0.7, -0.7)), 9.7, 0.07, 1.0) * fine;
        g += wave(p, normalize(vec2(0.2, -0.98)), 4.3, 0.028, 1.0) * fine;
        g += wave(p, normalize(vec2(-0.9, 0.4)), 2.3, 0.013, 1.0) * fine;
        float e = 0.6;
        vec2 q = p * 0.55 + vec2(uTime * 0.35, -uTime * 0.21);
        float n0 = vnoise(q);
        g += vec2(vnoise(q + vec2(e, 0.0)) - n0, vnoise(q + vec2(0.0, e)) - n0) * 0.35 * fine * (1.0 - smoothstep(0.25, 0.7, gPx));
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

        // Depth from the terrain height texture: 0.5 is sea level.
        vec2 uv = p / uSize + 0.5;
        float hv = 0.0;
        if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) hv = texture2D(uHeight, uv).r;
        float depth = max(0.0, (0.5 - hv) * 2.0 * uRange);
        float shallowK = exp(-depth * 0.16);
        vec3 body = mix(uDeep, uShallow, shallowK);
        body = mix(body, uSand * 0.9, exp(-depth * 0.9) * 0.75);

        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 col = mix(body * (0.55 + 0.45 * max(uSun.y, 0.0) * 2.0), skyColor(R), clamp(fres, 0.0, 1.0));

        // Sun glitter.
        float mu = max(dot(R, uSun), 0.0);
        float spark = pow(mu, 1400.0) * 90.0 * uSparkle * (0.35 + 0.65 * fine);
        float path = pow(mu, 60.0) * 0.55 + pow(mu, 8.0) * 0.12;
        col += uSunColor * (spark + path);

        // Shore foam: a band that breathes with the swell.
        float band = exp(-depth * 1.4) * smoothstep(0.495, 0.47, hv);
        float swell = 0.55 + 0.45 * sin(depth * 2.2 - uTime * 1.6 + vnoise(p * 0.08) * 6.0);
        float foamK = clamp(band * swell * (0.6 + 0.8 * vnoise(p * 0.35 + uTime * 0.2)), 0.0, 1.0);
        col = mix(col, uFoam * (0.6 + 0.6 * max(uSun.y, 0.2)), foamK * 0.8);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(extent, extent, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  return {
    mesh,
    uniforms,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}
