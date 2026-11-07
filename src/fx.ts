import * as THREE from 'three';

/**
 * One post-processing pass over the 3D layer.
 *
 * Thermal-glitch lens (follows the cursor while it is over the device):
 *  - heat is computed separately for offset R, G and B samples, so the thermal ramp
 *    itself tears into colour channels instead of sitting on top as a flat filter
 *  - heat is posterised into bands, the rim of the lens breaks into pixel blocks,
 *    and bands inside the lens shift sideways harder the faster the cursor moves
 *  - the screen quad is masked out, so the display stays readable under the lens
 *
 * Global glitch (uGlitch 0..1): RGB split and band shifts on program switches.
 *
 * Colours arrive premultiplied by alpha (transparent canvas), so the lens only
 * recolours pixels the device actually covers.
 */
export const ThermalGlitchShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uThermal: { value: 0 },
    uGlitch: { value: 0 },
    uSpeed: { value: 0 },
    uTime: { value: 0 },
    uQuad: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uMouse;
    uniform vec2 uRes;
    uniform float uThermal;
    uniform float uGlitch;
    uniform float uSpeed;
    uniform float uTime;
    uniform vec2 uQuad[4];
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    // thermal ramp in the site's colours, capped below white so it never blows out
    vec3 thermal(float t) {
      t = clamp(t, 0.0, 1.0);
      vec3 c0 = vec3(0.03, 0.02, 0.06);
      vec3 c1 = vec3(0.24, 0.03, 0.18);
      vec3 c2 = vec3(0.85, 0.24, 0.36);
      vec3 c3 = vec3(0.92, 0.52, 0.16);
      vec3 c4 = vec3(0.72, 0.88, 0.22);
      if (t < 0.25) return mix(c0, c1, t / 0.25);
      if (t < 0.55) return mix(c1, c2, (t - 0.25) / 0.3);
      if (t < 0.8) return mix(c2, c3, (t - 0.55) / 0.25);
      return mix(c3, c4, (t - 0.8) / 0.2);
    }

    float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
    // 1 inside the projected screen quad (convex, either winding), 0 outside
    float inQuad(vec2 p) {
      float s0 = cross2(uQuad[1] - uQuad[0], p - uQuad[0]);
      float s1 = cross2(uQuad[2] - uQuad[1], p - uQuad[1]);
      float s2 = cross2(uQuad[3] - uQuad[2], p - uQuad[2]);
      float s3 = cross2(uQuad[0] - uQuad[3], p - uQuad[3]);
      bool pos = s0 >= 0.0 && s1 >= 0.0 && s2 >= 0.0 && s3 >= 0.0;
      bool neg = s0 <= 0.0 && s1 <= 0.0 && s2 <= 0.0 && s3 <= 0.0;
      return (pos || neg) ? 1.0 : 0.0;
    }

    float heatOf(vec4 c, float centre) {
      vec3 s = c.a > 0.0 ? c.rgb / c.a : c.rgb;
      float lum = dot(s, vec3(0.299, 0.587, 0.114));
      return 0.16 + lum * 1.1 + centre * 0.42;
    }

    void main() {
      vec2 uv = vUv;
      float tick = floor(uTime * 24.0);

      // ---------- lens geometry ----------
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      float R = 0.2;
      float d = length((vUv - uMouse) * asp);
      float lens = smoothstep(R, R * 0.4, d) * uThermal;
      float rim = smoothstep(R * 0.55, R, d) * step(d, R) * uThermal; // outer band of the lens
      float onScreen = inQuad(vUv);

      // ---------- glitch: global + inside the lens ----------
      float band = floor(uv.y * 26.0);
      float on = step(1.0 - uGlitch * 0.55, hash(vec2(band, tick)));
      uv.x += (hash(vec2(band, tick + 7.0)) - 0.5) * 0.09 * on * uGlitch;

      float lensBand = floor(uv.y * uRes.y / 6.0);
      float tear = step(0.72 - uSpeed * 0.35, hash(vec2(lensBand, tick)));
      uv.x += (hash(vec2(lensBand, tick + 3.0)) - 0.5) * (0.004 + uSpeed * 0.03) * tear * lens;

      // pixel blocks on the rim
      if (rim > 0.05) {
        float px = mix(1.0, 7.0, rim);
        uv = (floor(uv * uRes / px) + 0.5) * px / uRes;
      }

      float split = 0.007 * uGlitch + 0.003 * on * uGlitch + lens * (0.004 + uSpeed * 0.01);
      vec4 cr = texture2D(tDiffuse, uv + vec2(split, 0.0));
      vec4 cg = texture2D(tDiffuse, uv);
      vec4 cb = texture2D(tDiffuse, uv - vec2(split, 0.0));
      vec4 col = vec4(cr.r, cg.g, cb.b, max(cg.a, max(cr.a, cb.a)));

      // ---------- thermal, per channel ----------
      // on the display the lens only tints faintly and tears, so the content stays legible
      float strength = lens * mix(0.62, 0.1, onScreen);
      if (strength > 0.001) {
        float centre = smoothstep(R, 0.0, d);
        float noise = (hash(floor(vUv * uRes / 2.0) + tick) - 0.5) * 0.05;
        float hr = floor((heatOf(cr, centre) + noise) * 7.0) / 7.0;
        float hg = floor((heatOf(cg, centre) + noise) * 7.0) / 7.0;
        float hb = floor((heatOf(cb, centre) + noise) * 7.0) / 7.0;
        vec3 th = vec3(thermal(hr).r, thermal(hg).g, thermal(hb).b);
        th *= 0.9 + 0.1 * sin(vUv.y * uRes.y * 1.4); // scanlines
        col.rgb = mix(col.rgb, th * col.a, strength);
      }

      gl_FragColor = col;
    }
  `,
};
