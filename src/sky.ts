import { current, type Theme } from './theme';
import { reducedMotion } from './motion';

/**
 * Night sky behind the terminal.
 *  - stars in three depth layers that drift with the cursor; the ones near it brighten
 *  - scrolling fast stretches the stars into short streaks
 *  - constellations whose lines warm up to the accent near the cursor
 *  - shooting stars: a tapered three-layer tail (white core, accent, accent2 glow) that grows in as it
 *    ignites, a four-point glint at the head and sparks shed behind it; sometimes a small shower
 *  - clicking empty sky launches one from the click
 * The brightest live meteor is published in `skyLight`, so the 3D scene can sweep a light across the
 * device. Dark themes only; still stars and no meteors with reduced motion.
 */
export const skyLight = { x: 0, y: 0, i: 0, color: '#ffffff' }; // viewport px, intensity 0..1
let active = true;
/** Pause drawing while opaque sections cover the sky. */
export const setSkyActive = (on: boolean) => (active = on);

interface Star {
  x: number; // 0..1 of viewport
  y: number;
  r: number;
  a: number;
  tw: number; // twinkle phase
  d: number; // depth layer 0..2, nearer layers move more
}
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  life: number;
  len: number;
  w: number; // head width
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  life: number;
  hot: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const DEPTH = [6, 14, 26]; // px of drift per layer at full cursor deflection

export function startSky() {
  const reduced = reducedMotion;
  const cv = document.createElement('canvas');
  cv.className = 'sky';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const c = cv.getContext('2d')!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let stars: Star[] = [];
  let live: Star[] = []; // stars drawn every frame: the bright ones, and any near the cursor
  const layers = [0, 1, 2].map(() => document.createElement('canvas')); // the still stars, baked per depth
  let cons: { pts: [number, number][] }[] = [];

  const build = () => {
    dpr = Math.min(window.devicePixelRatio, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const n = Math.round((W * H) / (W < 700 ? 9000 : 6500));
    stars = Array.from({ length: n }, () => {
      const d = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;
      return {
        x: Math.random(),
        y: Math.random() * 0.95,
        r: d === 2 ? rnd(0.9, 1.5) : d === 1 ? rnd(0.6, 1) : rnd(0.35, 0.7),
        a: d === 2 ? rnd(0.4, 0.75) : rnd(0.12, 0.5),
        tw: Math.random() * Math.PI * 2,
        d,
      };
    });
    // the dim, distant stars are baked into one bitmap per depth; the bright ones twinkle live
    live = [];
    layers.forEach((l) => {
      l.width = cv.width + 64 * dpr;
      l.height = cv.height + 64 * dpr;
      const lc = l.getContext('2d')!;
      lc.setTransform(dpr, 0, 0, dpr, 32 * dpr, 32 * dpr);
    });
    for (const st of stars) {
      if (st.d === 2 || st.r > 0.85) {
        live.push(st);
        continue;
      }
      const lc = layers[st.d].getContext('2d')!;
      lc.fillStyle = `rgba(238,242,236,${st.a.toFixed(3)})`;
      lc.beginPath();
      lc.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
      lc.fill();
    }
    const shapes: [number, number][][] = [
      [[0, 0], [0.05, 0.04], [0.11, 0.03], [0.16, 0.08], [0.13, 0.15], [0.19, 0.17]],
      [[0, 0.06], [0.04, 0], [0.09, 0.05], [0.07, 0.12], [0.13, 0.14]],
      [[0, 0.1], [0.05, 0.05], [0.1, 0.07], [0.15, 0], [0.2, 0.04]],
    ];
    const spots: [number, number][] = [
      [0.62, 0.06],
      [0.8, 0.66],
      [0.04, 0.08],
    ];
    cons = shapes.map((sh, k) => {
      const [ox, oy] = spots[k];
      const s = W < 700 ? 1.6 : 1;
      return { pts: sh.map(([x, y]) => [ox + x * s * 0.9, oy + y * s * (W / H) * 0.9] as [number, number]) };
    });
  };
  build();
  window.addEventListener('resize', build);

  let A1 = current.accent;
  let A2 = current.accent2;
  let dark = !current.light;
  const show = () => (cv.style.display = dark ? '' : 'none');
  window.addEventListener('themechange', (e) => {
    const t = (e as CustomEvent<Theme>).detail;
    A1 = t.accent;
    A2 = t.accent2;
    dark = !t.light;
    show();
  });
  show();

  // pointer, eased, for parallax and the cursor glow
  const ptr = { x: -9999, y: -9999, px: 0, py: 0, tx: 0, ty: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.tx = e.clientX / W - 0.5;
      ptr.ty = e.clientY / H - 0.5;
    },
    { passive: true },
  );

  // scroll speed, smoothed, for the streaks
  let lastY = window.scrollY;
  let lastT = performance.now();
  let vel = 0; // px per ms, signed
  window.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const v = (window.scrollY - lastY) / Math.max(now - lastT, 8);
      vel += (v - vel) * 0.5;
      lastY = window.scrollY;
      lastT = now;
    },
    { passive: true },
  );

  const meteors: Meteor[] = [];
  const sparks: Spark[] = [];
  let next = performance.now() + rnd(2500, 5000);
  const launch = (now: number, x?: number, y?: number, delay = 0) => {
    const fromRight = x === undefined ? Math.random() < 0.6 : x > W * 0.5;
    const speed = (rnd(0.8, 1.25) * Math.max(W, 900)) / 1000; // px per ms
    const ang = rnd(0.55, 0.9) * (fromRight ? 1 : -1);
    meteors.push({
      x: x ?? (fromRight ? rnd(W * 0.45, W * 1.05) : rnd(-W * 0.05, W * 0.55)),
      y: y ?? rnd(-H * 0.05, H * 0.25),
      vx: -Math.sin(ang) * speed,
      vy: Math.cos(Math.abs(ang)) * speed,
      t0: now + delay,
      life: rnd(1000, 1600),
      len: rnd(260, 460),
      w: rnd(3.2, 4.6),
    });
  };
  const spawn = (now: number) => {
    launch(now);
    // one in five is a small shower: two more, parallel, a beat apart
    if (Math.random() < 0.2) {
      const m = meteors[meteors.length - 1];
      for (let i = 1; i <= 2; i++) {
        meteors.push({ ...m, x: m.x + rnd(-140, 140), y: m.y + rnd(-60, 60), t0: now + i * rnd(140, 320), len: m.len * rnd(0.55, 0.8), w: m.w * 0.7 });
      }
    }
    next = now + rnd(6000, 12000);
  };

  // click empty sky to launch one from there
  window.addEventListener('pointerdown', (e) => {
    if (reduced || !dark || !active) return;
    const el = e.target as Element;
    if (el.closest('a, button, input, [role="radio"], .project__card, .watch, .offers, .spec, .numbers, .more, .about')) return;
    if (document.documentElement.classList.contains('over-device')) return;
    launch(performance.now(), e.clientX, e.clientY);
  });

  if (import.meta.env.DEV)
    (window as unknown as { __meteor: (slow?: number) => void }).__meteor = (slow = 1) => {
      spawn(performance.now());
      for (const m of meteors) {
        m.life *= slow;
        m.vx /= slow;
        m.vy /= slow;
      }
    };

  const hexA = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(3)})`;
  };

  // a wedge from the head (width w) to a point at the tail
  const wedge = (hx: number, hy: number, tx: number, ty: number, w: number) => {
    const dx = hx - tx;
    const dy = hy - ty;
    const L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * w * 0.5;
    const ny = (dx / L) * w * 0.5;
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(hx + nx, hy + ny);
    c.arc(hx, hy, w * 0.5, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    c.closePath();
    c.fill();
  };

  const drawMeteor = (m: Meteor, now: number) => {
    const age = now - m.t0;
    if (age < 0) return 0;
    const k = age / m.life;
    if (k >= 1) return -1;
    const hx = m.x + m.vx * age;
    const hy = m.y + m.vy * age;
    const sp = Math.hypot(m.vx, m.vy);
    const ux = m.vx / sp;
    const uy = m.vy / sp;
    // ignition: the tail grows in over the first quarter, the head burns out over the last third
    const grow = Math.min(1, k / 0.25);
    const fade = k < 0.66 ? Math.min(1, k / 0.08) : 1 - (k - 0.66) / 0.34;
    const len = m.len * (0.35 + 0.65 * grow);
    const tx = hx - ux * len;
    const ty = hy - uy * len;

    c.globalCompositeOperation = 'lighter';
    // outer glow in accent2
    let g = c.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, hexA(A2, 0.5 * fade));
    g.addColorStop(0.6, hexA(A2, 0.18 * fade));
    g.addColorStop(1, hexA(A2, 0));
    c.fillStyle = g;
    wedge(hx, hy, tx, ty, m.w * 6);
    // body in the accent
    g = c.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, hexA(A1, 0.9 * fade));
    g.addColorStop(0.45, hexA(A1, 0.5 * fade));
    g.addColorStop(1, hexA(A1, 0));
    c.fillStyle = g;
    wedge(hx, hy, tx, ty, m.w * 2.6);
    // white-hot core, short
    g = c.createLinearGradient(hx, hy, hx - ux * len * 0.45, hy - uy * len * 0.45);
    g.addColorStop(0, `rgba(255,255,255,${(0.95 * fade).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    wedge(hx, hy, hx - ux * len * 0.45, hy - uy * len * 0.45, m.w * 0.7);

    // head: soft bloom plus a four-point glint that turns slowly
    const bloom = c.createRadialGradient(hx, hy, 0, hx, hy, 26);
    bloom.addColorStop(0, `rgba(255,255,255,${(0.75 * fade).toFixed(3)})`);
    bloom.addColorStop(0.35, hexA(A1, 0.25 * fade));
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = bloom;
    c.fillRect(hx - 26, hy - 26, 52, 52);
    const rot = age * 0.002;
    c.strokeStyle = `rgba(255,255,255,${(0.8 * fade).toFixed(3)})`;
    c.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const a = rot + (i * Math.PI) / 2;
      const r = i ? 9 : 15;
      c.beginPath();
      c.moveTo(hx - Math.cos(a) * r, hy - Math.sin(a) * r);
      c.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';

    // shed sparks while it burns
    if (fade > 0.3 && Math.random() < 0.7) {
      sparks.push({
        x: hx - ux * rnd(4, 30),
        y: hy - uy * rnd(4, 30),
        vx: m.vx * rnd(0.02, 0.08) + rnd(-0.03, 0.03),
        vy: m.vy * rnd(0.02, 0.08) + rnd(-0.02, 0.04),
        t0: now,
        life: rnd(380, 760),
        hot: Math.random() < 0.4,
      });
    }
    return fade;
  };

  const draw = (now: number) => {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!dark) return;

    ptr.px += (ptr.tx - ptr.px) * 0.05;
    ptr.py += (ptr.ty - ptr.py) * 0.05;
    vel *= 0.9;
    const streak = reduced ? 0 : Math.max(-60, Math.min(60, vel * 22)); // px of stretch

    // baked layers, each shifted by its depth; when scrolling fast, smeared along the scroll
    c.setTransform(1, 0, 0, 1, 0, 0);
    layers.forEach((l, d) => {
      const ox = (-ptr.px * DEPTH[d] - 32) * dpr;
      const oy = (-ptr.py * DEPTH[d] - 32) * dpr;
      c.globalAlpha = 1;
      c.drawImage(l, ox, oy);
      if (Math.abs(streak) > 2) {
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          c.globalAlpha = 0.35 * (1 - i / (steps + 1));
          c.drawImage(l, ox, oy - (streak * (d + 1) * 0.5 * i * dpr) / steps);
        }
      }
    });
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // live stars: twinkle, react to the cursor, stretch with scroll
    for (const s of live) {
      const x = s.x * W - ptr.px * DEPTH[s.d];
      const y = s.y * H - ptr.py * DEPTH[s.d];
      const near = Math.max(0, 1 - Math.hypot(ptr.x - x, ptr.y - y) / 170);
      const tw = reduced ? 1 : 0.6 + 0.4 * Math.sin(now * 0.0013 + s.tw);
      const a = Math.min(1, s.a * tw + near * 0.6);
      c.fillStyle = near > 0.05 ? hexA(A1, a) : `rgba(238,242,236,${a.toFixed(3)})`;
      if (Math.abs(streak) > 2) {
        c.strokeStyle = c.fillStyle;
        c.lineWidth = s.r * 1.6;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y - streak * (s.d + 1) * 0.5);
        c.stroke();
      } else {
        c.beginPath();
        c.arc(x, y, s.r * (1 + near * 0.8), 0, Math.PI * 2);
        c.fill();
      }
      // the brightest few get a tiny cross glint at their twinkle peak
      if (s.d === 2 && tw > 0.95 && !reduced) {
        c.strokeStyle = `rgba(255,255,255,${(a * 0.5).toFixed(3)})`;
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x - 4, y);
        c.lineTo(x + 4, y);
        c.moveTo(x, y - 4);
        c.lineTo(x, y + 4);
        c.stroke();
      }
    }

    // constellations, on the middle layer
    for (const k of cons) {
      const px = k.pts.map(([x, y]) => [x * W - ptr.px * DEPTH[1], y * H - ptr.py * DEPTH[1]]);
      const cx = px.reduce((a, p) => a + p[0], 0) / px.length;
      const cy = px.reduce((a, p) => a + p[1], 0) / px.length;
      const near = Math.max(0, 1 - Math.hypot(ptr.x - cx, ptr.y - cy) / 280);
      c.lineWidth = 1;
      c.strokeStyle = near > 0.02 ? hexA(A1, 0.12 + near * 0.55) : 'rgba(238,242,236,0.1)';
      c.beginPath();
      px.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      for (const [x, y] of px) {
        c.fillStyle = near > 0.02 ? hexA(A1, 0.5 + near * 0.5) : 'rgba(238,242,236,0.5)';
        c.beginPath();
        c.arc(x, y, 1.6 + near * 1.3, 0, Math.PI * 2);
        c.fill();
      }
    }

    // meteors and their sparks
    skyLight.i = 0;
    if (reduced) return;
    if (!meteors.length && now > next && !document.hidden) spawn(now);
    for (let i = meteors.length - 1; i >= 0; i--) {
      const f = drawMeteor(meteors[i], now);
      if (f < 0) {
        meteors.splice(i, 1);
        continue;
      }
      if (f > skyLight.i) {
        const m = meteors[i];
        const age = now - m.t0;
        Object.assign(skyLight, { x: m.x + m.vx * age, y: m.y + m.vy * age, i: f, color: A1 });
      }
    }
    c.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      const age = now - p.t0;
      const k = age / p.life;
      if (k >= 1) {
        sparks.splice(i, 1);
        continue;
      }
      const x = p.x + p.vx * age;
      const y = p.y + p.vy * age + 0.00004 * age * age; // a little droop
      c.fillStyle = p.hot ? `rgba(255,255,255,${(1 - k).toFixed(3)})` : hexA(k < 0.5 ? A1 : A2, 1 - k);
      c.beginPath();
      c.arc(x, y, (p.hot ? 1.3 : 1) * (1 - k * 0.6), 0, Math.PI * 2);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  };

  const loop = (now: number) => {
    if (active) draw(now);
    else skyLight.i = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
