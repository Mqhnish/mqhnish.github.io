import { current, type Theme } from './theme';

/**
 * Night sky behind the terminal: faint twinkling stars, a few constellations whose lines warm up
 * near the cursor, and now and then a shooting star in the theme colours.
 * The live shooting star is published in `skyLight`, so the 3D scene can sweep a light across the
 * device as it passes. Dark themes only; static stars with reduced motion.
 */
export const skyLight = { x: 0, y: 0, i: 0, color: '#ffffff' }; // x, y in viewport px; i 0..1
let active = true;
/** Pause drawing while opaque sections cover the sky. */
export const setSkyActive = (on: boolean) => (active = on);

interface Star {
  x: number; // 0..1 of viewport
  y: number;
  r: number;
  a: number;
  tw: number; // twinkle phase
}
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  life: number;
  len: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function startSky() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'sky';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const c = cv.getContext('2d')!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let stars: Star[] = [];
  let twinklers: Star[] = []; // only the brighter stars twinkle; the rest are baked into one bitmap
  const layer = document.createElement('canvas');
  let cons: { pts: [number, number][]; edges: [number, number][] }[] = [];

  const build = () => {
    dpr = Math.min(window.devicePixelRatio, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const n = Math.round((W * H) / (W < 700 ? 9000 : 6500));
    stars = Array.from({ length: n }, () => ({
      x: Math.random(),
      y: Math.random() * 0.92,
      r: Math.random() < 0.08 ? rnd(1.1, 1.6) : rnd(0.4, 0.9),
      a: rnd(0.12, 0.55),
      tw: Math.random() * Math.PI * 2,
    }));
    // bake the still stars once per resize
    layer.width = cv.width;
    layer.height = cv.height;
    const lc = layer.getContext('2d')!;
    lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    twinklers = [];
    for (const st of stars) {
      if (st.r > 0.8 || Math.random() < 0.12) {
        twinklers.push(st);
        continue;
      }
      lc.fillStyle = `rgba(238,242,236,${st.a.toFixed(3)})`;
      lc.beginPath();
      lc.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
      lc.fill();
    }
    // constellations: small hand-shaped groups of 4-6 stars, placed loosely around the edges
    const shapes: [number, number][][] = [
      [[0, 0], [0.05, 0.04], [0.11, 0.03], [0.16, 0.08], [0.13, 0.15], [0.19, 0.17]],
      [[0, 0.06], [0.04, 0], [0.09, 0.05], [0.07, 0.12], [0.13, 0.14]],
      [[0, 0], [0.06, 0.02], [0.08, 0.09], [0.02, 0.12]],
      [[0, 0.1], [0.05, 0.05], [0.1, 0.07], [0.15, 0], [0.2, 0.04]],
    ];
    const spots: [number, number][] = [
      [0.62, 0.06],
      [0.8, 0.66],
      [0.04, 0.08],
    ];
    cons = shapes.slice(0, spots.length).map((sh, k) => {
      const [ox, oy] = spots[k];
      const s = W < 700 ? 1.6 : 1;
      const pts = sh.map(([x, y]) => [ox + x * s * 0.9, oy + y * s * (W / H) * 0.9] as [number, number]);
      return { pts, edges: pts.slice(1).map((_, i) => [i, i + 1] as [number, number]) };
    });
  };
  build();
  window.addEventListener('resize', build);

  let A1 = current.accent;
  let A2 = current.accent2;
  let dark = !current.light;
  window.addEventListener('themechange', (e) => {
    const t = (e as CustomEvent<Theme>).detail;
    A1 = t.accent;
    A2 = t.accent2;
    dark = !t.light;
    cv.style.display = dark ? '' : 'none';
  });
  cv.style.display = dark ? '' : 'none';

  const ptr = { x: -9999, y: -9999 };
  window.addEventListener('pointermove', (e) => ((ptr.x = e.clientX), (ptr.y = e.clientY)), { passive: true });

  let meteor: Meteor | null = null;
  let next = performance.now() + rnd(2500, 5000);
  const spawn = (now: number) => {
    // enters high on one side and falls across, mostly steep diagonals, like the real thing
    const fromRight = Math.random() < 0.6;
    const speed = rnd(0.9, 1.4) * Math.max(W, 900) / 1000; // px per ms
    const ang = rnd(0.55, 0.95) * (fromRight ? 1 : -1);
    meteor = {
      x: fromRight ? rnd(W * 0.45, W * 1.05) : rnd(-W * 0.05, W * 0.55),
      y: rnd(-H * 0.05, H * 0.25),
      vx: -Math.sin(ang) * speed,
      vy: Math.cos(Math.abs(ang)) * speed,
      t0: now,
      life: rnd(900, 1500),
      len: rnd(280, 520),
    };
    next = now + rnd(6000, 13000);
  };

  if (import.meta.env.DEV) (window as unknown as { __meteor: (slow?: number) => void }).__meteor = (slow = 1) => {
      spawn(performance.now());
      if (meteor) {
        meteor.life *= slow;
        meteor.vx /= slow;
        meteor.vy /= slow;
      }
    };

  const hexA = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const draw = (now: number) => {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!dark) return;

    // stars: the baked layer plus the few that twinkle
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(layer, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of twinklers) {
      const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(now * 0.0012 + s.tw);
      c.fillStyle = `rgba(238,242,236,${(s.a * tw).toFixed(3)})`;
      c.beginPath();
      c.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      c.fill();
    }

    // constellations: lines warm up to the accent when the cursor is near
    for (const k of cons) {
      const px = k.pts.map(([x, y]) => [x * W, y * H]);
      const cx = px.reduce((a, p) => a + p[0], 0) / px.length;
      const cy = px.reduce((a, p) => a + p[1], 0) / px.length;
      const near = Math.max(0, 1 - Math.hypot(ptr.x - cx, ptr.y - cy) / 260);
      c.lineWidth = 1;
      c.strokeStyle = near > 0.02 ? hexA(A1, 0.18 + near * 0.55) : 'rgba(238,242,236,0.11)';
      c.beginPath();
      for (const [a, b] of k.edges) {
        c.moveTo(px[a][0], px[a][1]);
        c.lineTo(px[b][0], px[b][1]);
      }
      c.stroke();
      for (const [x, y] of px) {
        c.fillStyle = near > 0.02 ? hexA(A1, 0.55 + near * 0.45) : 'rgba(238,242,236,0.5)';
        c.beginPath();
        c.arc(x, y, 1.7 + near * 1.2, 0, Math.PI * 2);
        c.fill();
      }
    }

    // shooting star
    skyLight.i = 0;
    if (!reduced) {
      if (!meteor && now > next && !document.hidden) spawn(now);
      if (meteor) {
        const m = meteor;
        const age = now - m.t0;
        const k = age / m.life;
        if (k >= 1) meteor = null;
        else {
          const hx = m.x + m.vx * age;
          const hy = m.y + m.vy * age;
          const sp = Math.hypot(m.vx, m.vy);
          const tx = hx - (m.vx / sp) * m.len;
          const ty = hy - (m.vy / sp) * m.len;
          const fade = Math.sin(Math.min(k, 1) * Math.PI); // in and out
          // tail: accent near the head, accent2 further back, gone at the end
          const g = c.createLinearGradient(hx, hy, tx, ty);
          g.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
          g.addColorStop(0.12, hexA(A1, 0.95 * fade));
          g.addColorStop(0.55, hexA(A2, 0.55 * fade));
          g.addColorStop(1, hexA(A2, 0));
          c.lineCap = 'round';
          // a wide soft glow under a bright thin core
          c.strokeStyle = g;
          c.globalAlpha = 0.4;
          c.lineWidth = 16;
          c.beginPath();
          c.moveTo(hx, hy);
          c.lineTo(tx, ty);
          c.stroke();
          c.globalAlpha = 1;
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(hx, hy);
          c.lineTo(tx, ty);
          c.stroke();
          // soft glow around the head
          const rg = c.createRadialGradient(hx, hy, 0, hx, hy, 30);
          rg.addColorStop(0, `rgba(255,255,255,${0.7 * fade})`);
          rg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = rg;
          c.fillRect(hx - 30, hy - 30, 60, 60);
          Object.assign(skyLight, { x: hx, y: hy, i: fade, color: A1 });
        }
      }
    }
  };

  const loop = (now: number) => {
    if (active) draw(now);
    else skyLight.i = 0;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
