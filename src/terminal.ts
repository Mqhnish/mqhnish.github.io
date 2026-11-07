import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Screen, setScreenTheme } from './screens';
import { current, type Theme } from './theme';
import { ThermalGlitchShader } from './fx';
import type { ScreenMode } from './content';
import type { Program } from './screens';
import { skyLight } from './sky';

/**
 * The pocket trading terminal. GSAP drives `pose` from scroll; the render loop
 * eases towards it and layers pointer tilt, a slow float and a drag spring on top.
 */
export interface Pose {
  px: number; // horizontal position as a fraction of viewport width, 0 = centre
  py: number; // vertical position as a fraction of viewport height, 0 = centre
  s: number;
  rx: number;
  ry: number;
  rz: number;
}

const W = 2.7;
const H = 3.9;
const FRONT = 0.28; // z of the body's front face
const MODES: ScreenMode[] = ['arb', 'shopilot', 'marg', 'notyet', 'yieldgpt'];

/* ---------- geometry helpers ---------- */
function roundedRect(w: number, h: number, r: number): THREE.Shape;
function roundedRect(w: number, h: number, r: number, path: THREE.Path): THREE.Path;
function roundedRect(w: number, h: number, r: number, path: THREE.Path = new THREE.Shape()) {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r);
  path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h);
  path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

function offsetPath(w: number, h: number, r: number, dy: number) {
  const p = roundedRect(w, h, r, new THREE.Path());
  // shift the hole up to where the screen sits
  const pts = p.getPoints(24).map((v) => new THREE.Vector2(v.x, v.y + dy));
  return new THREE.Path(pts);
}

function extrude(shape: THREE.Shape, depth: number, bevel: number, segs = 6) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segs,
    curveSegments: 32,
  });
  g.computeVertexNormals();
  return g;
}

function textTexture(lines: { text: string; color: string; font: string; y: number }[], w = 256, h = 96) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((l) => {
    x.fillStyle = l.color;
    x.font = l.font;
    x.fillText(l.text, w / 2, l.y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const label = (text: string, color: string, size = 40) =>
  textTexture([{ text, color, font: `700 ${size * 2}px "JetBrains Mono", monospace`, y: 100 }], 512, 192);

/* ---------- materials ---------- */
const M = {
  body: new THREE.MeshPhysicalMaterial({
    color: '#0b0b0c',
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1,
  }),
  plate: new THREE.MeshPhysicalMaterial({ color: '#070708', roughness: 0.62, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#f3f3ee', roughness: 0.07, metalness: 1, envMapIntensity: 1.3 }),
  key: new THREE.MeshPhysicalMaterial({ color: '#121214', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }),
  lime: new THREE.MeshPhysicalMaterial({ color: '#d4ff3a', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 }),
  pink: new THREE.MeshPhysicalMaterial({ color: '#ff8a9e', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 }),
  dark: new THREE.MeshStandardMaterial({ color: '#030303', roughness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.0,
    metalness: 0,
    transparent: true,
    opacity: 0.06,
    clearcoat: 1,
    envMapIntensity: 1.6,
    // thin-film sheen: the glass picks up a faint oil-slick rainbow from the studio lights
    iridescence: 1,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [160, 560],
  }),
};

type KeyAction = 'buy' | 'sell' | 'next';

interface Satellite {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  phase: number;
  spin: THREE.Vector3;
  depth: number;
}

export class Terminal {
  readonly pose: Pose = { px: 0.27, py: 0, s: 1, rx: 0.12, ry: -0.5, rz: 0.06 };
  visible = true;
  onModeChange: (m: Program) => void = () => {};
  /** BUY on the contact screen */
  onSayHi: () => void = () => {};

  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private fx: ShaderPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private group = new THREE.Group(); // follows the scroll pose
  private device = new THREE.Group(); // gets tilt + drag rotation
  private sats = new THREE.Group();
  private satellites: Satellite[] = [];
  private screen = new Screen();
  private screenTex: THREE.CanvasTexture;
  private led!: THREE.Mesh;
  private ledOn = new THREE.Color('#d4ff3a');
  private ledOff = new THREE.Color('#3d4a12');
  private themed: ((t: Theme) => void)[] = []; // redraws anything that carries an accent colour
  private rim!: THREE.PointLight;
  private warm!: THREE.PointLight;
  private frame = 0;
  private maxPr = 2; // lowered on slow machines
  private dtAvg = 1 / 60;
  private dtCount = 0;
  private meteor = new THREE.PointLight('#ffffff', 0, 16, 1.6); // follows the shooting star
  private meteorPos = new THREE.Vector3();
  private pmrem!: THREE.PMREMGenerator;
  private envTex: THREE.Texture | null = null;
  private screenMesh!: THREE.Mesh;
  private speed = 0; // smoothed cursor speed, 0..1
  private lastMove = { x: 0, y: 0, t: 0 };
  private corner = new THREE.Vector3();
  private keys: THREE.Mesh[] = [];
  private hitTargets: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2(-10, -10);
  private pointer = { x: 0, y: 0, cx: -1, cy: -1, has: false };
  private tilt = { x: 0, y: 0 };
  private cur: Pose = { ...this.pose };
  private reduced: boolean;

  private hover = false;
  private hoverKey: THREE.Mesh | null = null;
  private thermal = 0;
  private glitch = 0;
  private nextIdleGlitch = performance.now() + 4000;

  private drag = { on: false, moved: 0, lx: 0, ly: 0, lt: 0, x: 0, y: 0, vx: 0, vy: 0 };

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    // Neutral keeps brand colours (lime, pink, the screen) true instead of greying them like ACES
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environmentIntensity = 1;

    this.camera.position.set(0, 0, 13);

    this.screenTex = new THREE.CanvasTexture(this.screen.canvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    // sharpest sampling the GPU offers, so the screen holds up at an angle
    this.screenTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.screenTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.screenTex.magFilter = THREE.LinearFilter;

    this.buildDevice();
    this.buildSatellites();
    this.group.add(this.device, this.sats);
    this.scene.add(this.group);

    this.rim = new THREE.PointLight('#d4ff3a', 40, 22);
    this.rim.position.set(-4.5, 3, -2.5);
    this.warm = new THREE.PointLight('#ff8a9e', 30, 22);
    this.warm.position.set(5, -2.5, 3);
    const key = new THREE.DirectionalLight('#ffffff', 1.2);
    key.position.set(2, 5, 7);
    this.scene.add(this.rim, this.warm, key, this.meteor);

    // post-processing: render → thermal/glitch → tone map + sRGB.
    // The render target is multisampled: without it the composer drops the canvas's
    // antialiasing and every edge stair-steps.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    const rp = new RenderPass(this.scene, this.camera);
    rp.clearAlpha = 0;
    this.fx = new ShaderPass(ThermalGlitchShader);
    this.composer.addPass(rp);
    this.composer.addPass(this.fx);
    this.composer.addPass(new OutputPass());

    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('themechange', (e) => this.applyTheme((e as CustomEvent<Theme>).detail));
    this.resize();
    this.applyTheme(current);
  }

  /**
   * Studio lighting baked into an environment map: dark room, a few bright softboxes,
   * and two thin strips in the theme accents. Gives the glossy black clean reflections
   * instead of the grey patches a generic room produces.
   */
  private buildEnv(t: Theme) {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#040404');
    const add = (w: number, h: number, x: number, y: number, z: number, color: string, k: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    add(7, 4, 0, 7, 2, '#ffffff', 2.2); // top softbox
    add(1.2, 9, -7, 1, 3, '#ffffff', 3.2); // tall key strip, left
    add(1, 9, 7, 0, -1, '#ffffff', 1.5); // fill strip, right
    add(9, 1.4, 0, -3, 8, '#ffffff', 0.8); // low front bounce
    add(0.8, 9, -5, 0, -7, t.accent, 2.6); // accent kicker
    add(0.8, 9, 5, 0, -7, t.accent2, 2.2); // second accent kicker
    this.envTex?.dispose();
    this.envTex = this.pmrem.fromScene(env, 0.015).texture;
    this.scene.environment = this.envTex;
    env.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }

  applyTheme(t: Theme) {
    M.lime.color.set(t.accent);
    M.pink.color.set(t.accent2);
    // a faint self-glow keeps accent parts their true colour under the dark studio light
    M.lime.emissive.set(t.accent).multiplyScalar(0.22);
    M.pink.emissive.set(t.accent2).multiplyScalar(0.18);
    this.rim.color.set(t.accent);
    this.warm.color.set(t.accent2);
    this.ledOn.set(t.accent);
    this.ledOff.set(t.accent).multiplyScalar(0.22);
    setScreenTheme(t.accent, t.accent2);
    this.buildEnv(t);
    this.themed.forEach((f) => f(t));
  }

  /** a text label whose colours depend on the theme; redrawn on theme change */
  private themedLabel(mat: THREE.MeshBasicMaterial, draw: (t: Theme) => THREE.CanvasTexture) {
    const f = (t: Theme) => {
      mat.map?.dispose();
      mat.map = draw(t);
      mat.needsUpdate = true;
    };
    this.themed.push(f);
    f(current);
  }

  /* ---------------- model ---------------- */
  private buildDevice() {
    const bevel = 0.06;
    const depth = 0.44;

    // body: one extruded rounded slab with a real chamfer, so edges catch highlights
    const bodyGeo = extrude(roundedRect(W - bevel * 2, H - bevel * 2, 0.32), depth, bevel, 8);
    bodyGeo.translate(0, 0, -depth / 2);
    const body = new THREE.Mesh(bodyGeo, M.body);
    this.device.add(body);
    this.hitTargets.push(body);

    // lime rail sandwiched in the side, visible as a stripe around the edge
    const railGeo = extrude(roundedRect(W - 0.02, H - 0.02, 0.33), 0.07, 0);
    railGeo.translate(0, 0, -0.17);
    this.device.add(new THREE.Mesh(railGeo, M.lime));

    // front plate with a window for the screen
    const plateShape = roundedRect(W - 0.2, H - 0.2, 0.26) as THREE.Shape;
    plateShape.holes.push(offsetPath(2.44, 1.72, 0.1, 0.86));
    const plate = new THREE.Mesh(extrude(plateShape, 0.012, 0.012, 3), M.plate);
    plate.position.z = FRONT;
    this.device.add(plate);

    // recessed screen, glass and a chrome bezel ring
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.36, 1.652),
      new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }),
    );
    screen.position.set(0, 0.86, FRONT + 0.004);
    this.device.add(screen);
    this.screenMesh = screen;
    this.hitTargets.push(screen);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.7), M.glass);
    glass.position.set(0, 0.86, FRONT + 0.02);
    this.device.add(glass);

    const ringShape = roundedRect(2.5, 1.79, 0.13) as THREE.Shape;
    ringShape.holes.push(offsetPath(2.4, 1.69, 0.07, 0));
    const ring = new THREE.Mesh(extrude(ringShape, 0.016, 0.01, 4), M.chrome);
    ring.position.set(0, 0.86, FRONT + 0.03);
    this.device.add(ring);

    // top strip: LED, speaker slots, screws
    this.led = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshBasicMaterial({ color: '#d4ff3a', toneMapped: false }));
    this.led.position.set(-0.9, 1.84, FRONT + 0.026);
    this.device.add(this.led);
    const slot = new RoundedBoxGeometry(0.03, 0.17, 0.02, 2, 0.012);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(slot, M.dark);
      s.position.set(0.38 + i * 0.09, 1.84, FRONT + 0.024);
      this.device.add(s);
    }
    const screwGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24);
    screwGeo.rotateX(Math.PI / 2);
    const slotGeo = new THREE.BoxGeometry(0.07, 0.012, 0.01);
    [
      [-1.18, 1.84],
      [1.18, 1.84],
      [-1.18, -1.84],
      [1.18, -1.84],
    ].forEach(([x, y]) => {
      const sc = new THREE.Mesh(screwGeo, M.chrome);
      sc.position.set(x, y, FRONT + 0.03);
      const cut = new THREE.Mesh(slotGeo, M.dark);
      cut.position.z = 0.011;
      cut.rotation.z = Math.random() * Math.PI;
      sc.add(cut);
      this.device.add(sc);
    });

    // side buttons and a USB-C port
    const sideGeo = new RoundedBoxGeometry(0.08, 0.38, 0.14, 3, 0.035);
    const side1 = new THREE.Mesh(sideGeo, M.chrome);
    side1.position.set(W / 2 + 0.01, 1.05, 0);
    const side2 = new THREE.Mesh(sideGeo, M.lime);
    side2.position.set(W / 2 + 0.01, 0.52, 0);
    const port = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 0.13, 3, 0.04), M.dark);
    port.position.set(0, -H / 2 + 0.01, 0);
    this.device.add(side1, side2, port);

    // BUY / SELL
    const bigGeo = new RoundedBoxGeometry(1.12, 0.38, 0.13, 6, 0.07);
    const mkKey = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, text: string, color: (t: Theme) => string, action: KeyAction, w: number, h: number, size: number) => {
      const k = new THREE.Mesh(geo, mat);
      k.position.set(x, y, FRONT + 0.075);
      const lm = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      this.themedLabel(lm, (t) => label(text, color(t), size));
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lm);
      l.position.z = 0.067;
      k.add(l);
      k.userData = { action, rest: k.position.z, press: 0 };
      this.device.add(k);
      this.keys.push(k);
      this.hitTargets.push(k);
    };
    mkKey(bigGeo, M.lime, -0.6, -0.28, 'BUY', () => '#0a0a0a', 'buy', 0.9, 0.34, 44);
    mkKey(bigGeo, M.pink, 0.6, -0.28, 'SELL', () => '#0a0a0a', 'sell', 0.9, 0.34, 44);

    const smallGeo = new RoundedBoxGeometry(0.5, 0.28, 0.11, 6, 0.06);
    const labels = ['7', '8', '9', 'µs', '4', '5', '6', 'EV', '1', '2', '3', 'q'];
    labels.forEach((lab, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      mkKey(smallGeo, M.key, -0.93 + col * 0.62, -0.78 - row * 0.37, lab, (t) => (col === 3 ? t.accent : '#9a9a93'), 'next', 0.44, 0.165, 38);
    });

    // engraved model plate
    const brand = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.18),
      new THREE.MeshBasicMaterial({
        map: textTexture([{ text: 'MSR-01  ·  LOW LATENCY', color: '#5d5d57', font: '600 26px "JetBrains Mono", monospace', y: 30 }], 512, 60),
        transparent: true,
      }),
    );
    brand.position.set(0, -1.84, FRONT + 0.026);
    this.device.add(brand);
  }

  /* ---------------- company: chips and keycaps floating around it ---------------- */
  private buildSatellites() {
    const chipGeo = new RoundedBoxGeometry(1.15, 0.42, 0.08, 4, 0.06);
    const chips: [string, string, (t: Theme) => string, number, number, number][] = [
      ['BTC-PERP', '+0.42%', (t) => t.accent, -2.45, 1.35, 0.5],
      ['q (fill)', '0.83', () => '#f5f5f0', 1.85, 1.25, -1.3],
      ['EV', '+1.4 bps', (t) => t.accent, 1.2, -2.55, 0.6],
      ['latency', '6.4 µs', (t) => t.accent2, -2.2, -1.8, -0.4],
    ];
    chips.forEach(([k, v, col, x, y, z]) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(chipGeo, M.body);
      const fm = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      this.themedLabel(fm, (t) =>
        textTexture(
          [
            { text: k, color: '#8a8a84', font: '500 60px "JetBrains Mono", monospace', y: 68 },
            { text: v, color: col(t), font: '700 88px "JetBrains Mono", monospace', y: 164 },
          ],
          640,
          232,
        ),
      );
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.39), fm);
      face.position.z = 0.045;
      g.add(m, face);
      this.addSat(g, x, y, z);
    });

    const capGeo = new RoundedBoxGeometry(0.42, 0.42, 0.26, 5, 0.09);
    (
      [
        [M.lime, -2.75, 0.05, -1.0],
        [M.pink, -1.1, -2.55, 0.3],
        [M.key, -0.9, 2.5, -1.1],
        [M.chrome, 1.95, 0.7, -1.5],
      ] as [THREE.Material, number, number, number][]
    ).forEach(([mat, x, y, z]) => this.addSat(new THREE.Mesh(capGeo, mat), x, y, z));
  }

  private addSat(obj: THREE.Object3D, x: number, y: number, z: number) {
    obj.position.set(x, y, z);
    obj.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * 0.8 - 0.4, Math.random() * 0.4 - 0.2);
    this.sats.add(obj);
    this.satellites.push({
      obj,
      base: new THREE.Vector3(x, y, z),
      phase: Math.random() * Math.PI * 2,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.35),
      depth: 0.4 + (z + 1.5) * 0.25,
    });
  }

  /* ---------------- interaction ---------------- */
  private onMove = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    this.pointer.cx = e.clientX;
    this.pointer.cy = e.clientY;
    this.pointer.has = true;
    this.ndc.set(this.pointer.x, -this.pointer.y);
    const now = performance.now();
    const dtm = Math.max(now - this.lastMove.t, 1);
    const v = Math.hypot(e.clientX - this.lastMove.x, e.clientY - this.lastMove.y) / dtm; // px per ms
    this.speed = Math.max(this.speed, Math.min(v / 2.5, 1));
    this.lastMove = { x: e.clientX, y: e.clientY, t: now };

    if (this.drag.on) {
      const now = performance.now();
      const dt = Math.max((now - this.drag.lt) / 1000, 1 / 240);
      const dx = e.clientX - this.drag.lx;
      const dy = e.clientY - this.drag.ly;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      // 1:1-ish tracking: 0.008 rad per pixel, velocity kept for the release
      this.drag.y += dx * 0.008;
      this.drag.x += dy * 0.008;
      this.drag.vy = (dx * 0.008) / dt;
      this.drag.vx = (dy * 0.008) / dt;
      this.drag.lx = e.clientX;
      this.drag.ly = e.clientY;
      this.drag.lt = now;
    }
  };

  private onDown = (e: PointerEvent) => {
    if (!this.visible || !this.hover) return;
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    if (this.hoverKey) this.pressKey(this.hoverKey);
    if (e.pointerType === 'touch') return; // let touch keep scrolling the page
    e.preventDefault();
    Object.assign(this.drag, { on: true, moved: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 });
    document.documentElement.classList.add('is-grabbing');
  };

  private onUp = () => {
    if (!this.drag.on) return;
    this.drag.on = false;
    document.documentElement.classList.remove('is-grabbing');
    // a click on the body (not a key, not a drag) cycles the program
    if (this.drag.moved < 6 && !this.hoverKey) this.nextMode();
  };

  private pressKey(k: THREE.Mesh) {
    k.userData.press = 1;
    const now = performance.now();
    const a = k.userData.action as KeyAction;
    if (a === 'buy' && this.screen.current === 'hello') {
      this.screen.flash('HI!', 'opening your mail app', 'lime', now);
      setTimeout(() => this.onSayHi(), 450);
    } else if (a === 'buy') this.screen.flash('BUY', 'filled 0.01 BTC · 6.4 µs', 'lime', now);
    else if (a === 'sell') this.screen.flash('SELL', 'filled 0.01 BTC · leg risk ok', 'pink', now);
    else this.nextMode();
    this.kick(a === 'next' ? 0.5 : 0.3);
  }

  private nextMode() {
    const i = MODES.indexOf(this.screen.current as ScreenMode); // from 'hello' (-1) this wraps to the first project
    this.setMode(MODES[(i + 1) % MODES.length], false);
    this.onModeChange(this.screen.current);
  }

  private kick(amount: number) {
    if (this.reduced) return;
    this.glitch = Math.max(this.glitch, amount);
  }

  setMode(mode: Program, pressKey = true) {
    if (mode === this.screen.current) return;
    this.screen.setMode(mode, performance.now());
    this.kick(0.7);
    if (pressKey) this.keys[2 + Math.floor(Math.random() * 12)].userData.press = 1;
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, this.maxPr);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.fx.uniforms.uRes.value.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private updateHover() {
    if (!this.pointer.has || !this.visible) {
      this.hover = false;
      this.hoverKey = null;
      return;
    }
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0];
    const was = this.hover;
    this.hover = !!hit;
    this.hoverKey = hit && this.keys.includes(hit.object as THREE.Mesh) ? (hit.object as THREE.Mesh) : null;
    if (this.hover && !was) this.kick(0.35);
    const root = document.documentElement.classList;
    root.toggle('over-device', this.hover);
    root.toggle('over-key', !!this.hoverKey);
  }

  /* ---------------- frame ---------------- */
  render(time: number, dt: number) {
    if (!this.visible) {
      document.documentElement.classList.remove('over-device', 'over-key');
      return;
    }

    // ease towards the scroll pose (frame-rate independent)
    const k = 1 - Math.exp(-dt * 6);
    const c = this.cur;
    const p = this.pose;
    c.px += (p.px - c.px) * k;
    c.py += (p.py - c.py) * k;
    c.s += (p.s - c.s) * k;
    c.rx += (p.rx - c.rx) * k;
    c.ry += (p.ry - c.ry) * k;
    c.rz += (p.rz - c.rz) * k;

    if (!this.reduced) {
      const kt = 1 - Math.exp(-dt * 4);
      this.tilt.x += (this.pointer.y * 0.16 - this.tilt.x) * kt;
      this.tilt.y += (this.pointer.x * 0.26 - this.tilt.y) * kt;
    }

    // drag spring: critically-damped-ish return with the release velocity handed off
    if (!this.drag.on) {
      const stiff = 120;
      const damp = 2 * 0.78 * Math.sqrt(stiff);
      this.drag.vx += (-stiff * this.drag.x - damp * this.drag.vx) * dt;
      this.drag.vy += (-stiff * this.drag.y - damp * this.drag.vy) * dt;
      this.drag.x += this.drag.vx * dt;
      this.drag.y += this.drag.vy * dt;
    }

    const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const viewW = viewH * this.camera.aspect;
    const float = this.reduced ? 0 : Math.sin(time * 0.0011) * 0.08;
    this.group.position.set(c.px * viewW, -c.py * viewH + float, 0);
    this.group.scale.setScalar(c.s);
    this.group.rotation.set(c.rx, c.ry, c.rz + (this.reduced ? 0 : Math.sin(time * 0.0007) * 0.02));
    this.device.rotation.set(this.tilt.x + this.drag.x, this.tilt.y + this.drag.y, 0);

    // satellites bob and tumble, with a little pointer parallax by depth
    const ts = time * 0.001;
    const spread = this.camera.aspect < 0.8 ? 0.62 : 1; // pull them in on portrait phones
    for (const s of this.satellites) {
      // on portrait phones the lowest pieces would sit on the name, so they sit this one out
      s.obj.visible = !(spread < 1 && s.base.y < -2.2);
      const bob = this.reduced ? 0 : Math.sin(ts * 0.9 + s.phase) * 0.12;
      s.obj.position.set(
        s.base.x * spread + this.tilt.y * s.depth * 1.2,
        s.base.y + bob - this.tilt.x * s.depth,
        s.base.z,
      );
      if (!this.reduced) {
        s.obj.rotation.x += s.spin.x * dt;
        s.obj.rotation.y += s.spin.y * dt;
        s.obj.rotation.z += s.spin.z * dt * 0.5;
      }
    }

    // key press springs
    for (const key of this.keys) {
      const u = key.userData;
      u.press = Math.max(0, u.press - dt * 5);
      const target = key === this.hoverKey ? 0.012 : 0;
      key.position.z = u.rest - u.press * 0.05 - target;
    }

    this.updateHover();

    // thermal lens fades in while hovering; glitch decays; rare idle glitch
    this.thermal += ((this.hover ? 1 : 0) - this.thermal) * (1 - Math.exp(-dt * 8));
    this.glitch = Math.max(0, this.glitch - dt * 2.6);
    if (!this.reduced && time > this.nextIdleGlitch) {
      this.kick(0.28);
      this.nextIdleGlitch = time + 5000 + Math.random() * 5000;
    }
    const u = this.fx.uniforms;
    u.uThermal.value = this.thermal;
    this.speed *= Math.exp(-dt * 3);
    u.uSpeed.value = this.speed;
    // project the screen's corners so the shader can keep the display readable under the lens
    this.screenMesh.updateWorldMatrix(true, false);
    const q = u.uQuad.value as THREE.Vector2[];
    [
      [-1.18, -0.826],
      [1.18, -0.826],
      [1.18, 0.826],
      [-1.18, 0.826],
    ].forEach(([x, y], i) => {
      this.corner.set(x, y, 0).applyMatrix4(this.screenMesh.matrixWorld).project(this.camera);
      q[i].set(this.corner.x * 0.5 + 0.5, this.corner.y * 0.5 + 0.5);
    });
    u.uGlitch.value = this.glitch;
    u.uTilt.value.set(this.tilt.y + this.drag.y, this.tilt.x + this.drag.x);
    u.uTime.value = ts;
    if (this.pointer.has) u.uMouse.value.set(this.pointer.cx / window.innerWidth, 1 - this.pointer.cy / window.innerHeight);

    // a passing shooting star: put a light where its head is, a little in front of the device,
    // so its glow slides across the glossy body and the glass
    if (skyLight.i > 0.01) {
      const nx = (skyLight.x / window.innerWidth) * 2 - 1;
      const ny = -((skyLight.y / window.innerHeight) * 2 - 1);
      this.meteorPos.set(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
      const dist = (this.camera.position.z - 2.2) / -this.meteorPos.z; // reach the plane z = 2.2
      this.meteor.position.copy(this.camera.position).addScaledVector(this.meteorPos, dist);
      this.meteor.color.set(skyLight.color).lerp(new THREE.Color('#ffffff'), 0.45);
      this.meteor.intensity = skyLight.i * 70;
    } else this.meteor.intensity = 0;

    (this.led.material as THREE.MeshBasicMaterial).color.copy(Math.floor(time / 700) % 2 ? this.ledOn : this.ledOff);

    // the screen redraws at 30 fps: half the texture uploads, and nobody reads an order book faster
    this.frame++;
    if (this.frame % 2 === 0) {
      this.screen.draw(time);
      this.screenTex.needsUpdate = true;
    }

    // if frames keep running slow, render at a lower pixel ratio (2 -> 1.5 -> 1)
    this.dtAvg += (dt - this.dtAvg) * 0.02;
    if (++this.dtCount > 240 && this.dtAvg > 1 / 42 && this.maxPr > 1) {
      this.maxPr -= 0.5;
      this.dtCount = 0;
      this.resize();
    }
    this.composer.render(dt);
  }
}
