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
 * Holographic screen (inside the projected screen quad):
 *  - a faint thin-film arch slides across the glass as the device tilts, so it reads as a reflection
 *  - under the cursor the display breaks into square pixels, each block posterised to its own thermal
 *    colour with a glitch channel tear; shallow enough to read through
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
    uTilt: { value: new THREE.Vector2() },
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
    uniform vec2 uTilt;
    varying vec2 vUv;

    // thin-film interference, approximated with a cosine rainbow
    vec3 film(float h) {
      return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67)));
    }

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

    // position inside the screen quad, 0..1 on each axis (exact for a parallelogram, close enough in perspective)
    vec2 quadUv(vec2 p) {
      vec2 e1 = uQuad[1] - uQuad[0];
      vec2 e2 = uQuad[3] - uQuad[0];
      vec2 q = p - uQuad[0];
      float det = cross2(e1, e2);
      return vec2(cross2(q, e2), cross2(e1, q)) / det;
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

      // ---------- holographic screen ----------
      vec2 suv = quadUv(vUv);
      vec2 mScreen = quadUv(uMouse);
      // mosaic under the cursor: square blocks, bigger towards the middle of the lens
      float mosaic = smoothstep(R * 0.5, R * 0.18, d) * uThermal * onScreen;
      if (mosaic > 0.04) {
        float px = floor(mix(3.0, 11.0, mosaic));
        uv = (floor(uv * uRes / px) + 0.5) * px / uRes;
      }

      // pixel blocks on the rim (off the screen)
      if (rim > 0.05 && onScreen < 0.5) {
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
      float strength = lens * (1.0 - onScreen) * 0.62;
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

      // ---------- the film over the screen ----------
      if (onScreen > 0.5) {
        // an arch whose centre drifts with tilt and time, and leans towards the cursor while hovering
        vec2 c = vec2(0.5 + uTilt.x * 1.6 + sin(uTime * 0.21) * 0.18, -0.25 - uTilt.y * 1.4);
        c = mix(c, mScreen + vec2(0.0, -0.35), uThermal * 0.6);
        float r = length((suv - c) * vec2(1.0, 1.35));
        float arch = smoothstep(0.12, 0.0, abs(r - 0.62));
        float hue = r * 2.4 - uTime * 0.05 + uTilt.x;
        vec3 sheen = film(hue);
        // inside the mosaic each square goes thermal: its own heat, posterised, with the channels torn apart
        vec2 cell = floor(vUv * uRes / 11.0);
        float flick = hash(cell + floor(uTime * 8.0));
        float h = floor((heatOf(col, mosaic) + (flick - 0.5) * 0.18) * 6.0) / 6.0;
        vec3 heat = thermal(h);
        float tearB = step(0.82, flick) * 0.08;
        vec3 blockTint = vec3(thermal(h + tearB).r, heat.g, thermal(h - tearB).b);
        float a = col.a;
        col.rgb += sheen * arch * 0.08 * a;                    // a faint travelling reflection on the glass
        col.rgb = mix(col.rgb, col.rgb * 0.55 + blockTint * 0.5 * a, mosaic * 0.7);
      }

      gl_FragColor = col;
    }
  `,
};
