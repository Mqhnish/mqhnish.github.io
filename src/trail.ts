import { current, rgba, type Theme } from './theme';

/**
 * Cursor trail: a tapering ribbon in the theme accent, drawn on a 2D canvas above the page.
 * On dark themes it blends with `difference`, so it inverts on the accent band. A click sends out a ring.
 * Only runs for a fine pointer with hover and without reduced motion.
 */
interface P {
  x: number;
  y: number;
  t: number;
  w?: number; // width when the point was laid down, from pointer speed
}

export function startTrail() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

  const cv = document.createElement('canvas');
  cv.className = 'trail';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const c = cv.getContext('2d')!;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio, 2);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  };
  resize();
  window.addEventListener('resize', resize);

  const pts: P[] = [];
  const rings: P[] = [];
  let A1 = current.accent;
  let A2 = current.accent2;
  window.addEventListener('themechange', (e) => {
    const t = (e as CustomEvent<Theme>).detail;
    A1 = t.accent;
    A2 = t.accent2;
  });
  const LIFE = 520; // ms a point stays on the ribbon
  const head = { x: -100, y: -100 };
  let width = 6; // smoothed, so the ribbon swells and thins instead of jumping
  let lastT = performance.now();
  let target = { x: -100, y: -100 };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      // first move, or a jump back into the window: start the ribbon here, no streak from the old spot
      if (target.x < 0 || Math.hypot(e.clientX - target.x, e.clientY - target.y) > 240) {
        head.x = e.clientX;
        head.y = e.clientY;
        pts.length = 0;
      }
      target = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') rings.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  document.addEventListener('mouseleave', () => (target = { x: -100, y: -100 }));

  const frame = () => {
    const now = performance.now();
    // the head eases after the pointer, which smooths the ribbon at low event rates
    const px = head.x;
    const py = head.y;
    head.x += (target.x - head.x) * 0.45;
    head.y += (target.y - head.y) * 0.45;
    const dt = Math.max(now - lastT, 1);
    lastT = now;
    // faster strokes draw fatter: 6px when drifting, up to ~34px on a flick
    const speed = Math.hypot(head.x - px, head.y - py) / dt; // px per ms
    width += (Math.min(6 + speed * 16, 34) - width) * 0.18;
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - head.x, last.y - head.y) > 1.5) pts.push({ x: head.x, y: head.y, t: now, w: width });
    while (pts.length && now - pts[0].t > LIFE) pts.shift();

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const life = 1 - (now - b.t) / LIFE;
      // a slow wobble along the ribbon keeps it from reading as a uniform tube
      const wobble = 0.75 + 0.25 * Math.sin(b.t * 0.018 + i * 0.35);
      c.strokeStyle = rgba(A1, Math.min(1, life * 1.1) * 0.92);
      c.lineWidth = Math.max(1, (b.w ?? 6) * Math.pow(life, 0.7) * wobble);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const age = (now - r.t) / 500;
      if (age >= 1) {
        rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - age, 3);
      c.strokeStyle = rgba(A2, 1 - age);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(r.x, r.y, 6 + e * 38, 0, Math.PI * 2);
      c.stroke();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Dot-matrix ambience behind the device: two dot layers (lime and pink) revealed
 * through soft drifting blobs, a little like a heat map. Pure CSS masks, JS only moves them.
 */
export function startField() {
  const field = document.createElement('div');
  field.className = 'field';
  field.setAttribute('aria-hidden', 'true');
  field.innerHTML = '<div class="field__l"></div><div class="field__p"></div>';
  document.body.prepend(field);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mx = 0.7;
  let my = 0.4;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX / innerWidth;
    my = e.clientY / innerHeight;
  });
  const set = (t: number) => {
    const s = field.style;
    s.setProperty('--x1', `${(68 + Math.sin(t * 0.00023) * 10 + (mx - 0.5) * 8).toFixed(2)}%`);
    s.setProperty('--y1', `${(42 + Math.cos(t * 0.00031) * 12 + (my - 0.5) * 8).toFixed(2)}%`);
    s.setProperty('--x2', `${(82 + Math.cos(t * 0.00019) * 9).toFixed(2)}%`);
    s.setProperty('--y2', `${(70 + Math.sin(t * 0.00027) * 10).toFixed(2)}%`);
    s.setProperty('--x3', `${(mx * 100).toFixed(2)}%`);
    s.setProperty('--y3', `${(my * 100).toFixed(2)}%`);
  };
  if (reduced) {
    set(0);
    return;
  }
  const loop = (t: number) => {
    set(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
