import { current, type Theme } from './theme';
import { reducedMotion } from './motion';

/**
 * Ink cursor: a liquid blob that follows the pointer and smears into a tapering stroke when you move fast.
 * It is drawn in white on a canvas blended with `difference`, so it inverts whatever it passes over:
 * dark page turns light, light text turns dark. Over the accent band it is drawn in the accent instead,
 * which inverts that band to black with accent text. The edges carry a thin two-colour fringe that leans
 * against the direction of travel. A click sends out a ring. Fine pointers only, never with reduced motion.
 */
interface P {
  x: number;
  y: number;
  t: number;
  r: number; // radius when the point was laid down
}

export function startTrail() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = reducedMotion;
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
  const rings: { x: number; y: number; t: number }[] = [];
  let A1 = current.accent;
  let A2 = current.accent2;
  window.addEventListener('themechange', (e) => {
    const t = (e as CustomEvent<Theme>).detail;
    A1 = t.accent;
    A2 = t.accent2;
  });
  const band = document.querySelector<HTMLElement>('.numbers');

  const LIFE = 620; // ms a point stays in the smear
  const head = { x: -200, y: -200, vx: 0, vy: 0 };
  let target = { x: -200, y: -200 };
  let radius = 0; // grows in on first move, so the blob doesn't pop in
  let hot = false; // over a link or button: the blob swells
  let lastT = performance.now();

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      if (target.x < -100 || Math.hypot(e.clientX - target.x, e.clientY - target.y) > 260) {
        head.x = e.clientX;
        head.y = e.clientY;
        pts.length = 0;
      }
      target = { x: e.clientX, y: e.clientY };
      hot = !!(e.target as Element).closest?.('a, button, [role="radio"]');
    },
    { passive: true },
  );
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') rings.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  document.addEventListener('mouseleave', () => (target = { x: -200, y: -200 }));

  // a wobbly circle, stretched along the direction of travel: reads as liquid rather than a dot
  const blob = (x: number, y: number, r: number, t: number, ang: number, stretch: number) => {
    c.beginPath();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + 0.07 * Math.sin(3 * a + t * 0.004) + 0.045 * Math.sin(5 * a - t * 0.0031));
      // stretch in the travel frame
      const lx = Math.cos(a) * rr * stretch;
      const ly = Math.sin(a) * rr / Math.sqrt(stretch);
      const px = x + lx * Math.cos(ang) - ly * Math.sin(ang);
      const py = y + lx * Math.sin(ang) + ly * Math.cos(ang);
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    c.fill();
  };

  // one full pass of the shape (smear + head) in the current fill style, offset by (ox, oy)
  const shape = (now: number, ox: number, oy: number, ang: number, stretch: number, heat = false) => {
    c.save();
    c.translate(ox, oy);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const life = 1 - (now - b.t) / LIFE;
      // thermal tail: the fresh ink is white-hot, it cools through the accent into accent2
      if (heat) c.strokeStyle = life > 0.62 ? '#ffffff' : life > 0.3 ? A1 : A2;
      c.lineWidth = Math.max(0.5, b.r * 2 * Math.pow(life, 0.9));
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    if (radius > 0.5) blob(head.x, head.y, radius, now, ang, stretch);
    c.restore();
  };

  const frame = () => {
    const now = performance.now();
    const dt = Math.min(Math.max(now - lastT, 1), 50);
    lastT = now;
    // the head chases the pointer on a soft spring, so it lags and overshoots a little, like ink
    const k = 1 - Math.exp(-dt / 55);
    head.vx = (target.x - head.x) * k;
    head.vy = (target.y - head.y) * k;
    head.x += head.vx;
    head.y += head.vy;
    const speed = Math.hypot(head.vx, head.vy) / dt; // px per ms
    const want = target.x < -100 ? 0 : hot ? 34 : 18 + Math.min(speed * 26, 46);
    radius += (want - radius) * (1 - Math.exp(-dt / 90));
    const ang = Math.atan2(head.vy, head.vx);
    const stretch = 1 + Math.min(speed * 0.5, 0.6);

    const last = pts[pts.length - 1];
    if (radius > 1 && (!last || Math.hypot(last.x - head.x, last.y - head.y) > 2)) pts.push({ x: head.x, y: head.y, t: now, r: radius * 0.92 });
    while (pts.length && now - pts[0].t > LIFE) pts.shift();

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // fringe: accent2 trailing, accent leading, a few px either side of the travel direction
    const f = Math.round(Math.min(1.5 + speed * 5, 5) + (Math.random() < 0.06 ? 4 : 0));
    const fx = Math.cos(ang) * f;
    const fy = Math.sin(ang) * f;
    c.globalAlpha = 0.9;
    c.fillStyle = c.strokeStyle = A2;
    shape(now, -fx, -fy, ang, stretch);
    c.fillStyle = c.strokeStyle = A1;
    shape(now, fx, fy, ang, stretch);
    c.globalAlpha = 1;
    // the ink itself
    c.fillStyle = c.strokeStyle = '#ffffff';
    shape(now, 0, 0, ang, stretch, true);

    // glitch: on fast strokes, slice a few horizontal bands of the ink and shove them sideways
    if (speed > 0.6 && Math.random() < 0.55) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const y = head.y + (Math.random() - 0.5) * radius * 3;
        const h = 3 + Math.random() * 9;
        const dx = (Math.random() - 0.5) * Math.min(speed * 30, 40);
        c.drawImage(cv, 0, y * dpr, cv.width, h * dpr, dx, y, innerWidth, h);
      }
    }

    // over the accent band, recolour the ink to the accent so the band inverts to black, not to purple
    if (band) {
      const r = band.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const cut = innerWidth * 0.05; // matches the band's skewed clip-path
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = A1;
        c.beginPath();
        c.moveTo(r.left, r.top + cut);
        c.lineTo(r.right, r.top);
        c.lineTo(r.right, r.bottom - cut);
        c.lineTo(r.left, r.bottom);
        c.closePath();
        c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const age = (now - r.t) / 520;
      if (age >= 1) {
        rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - age, 3);
      c.strokeStyle = '#ffffff';
      c.globalAlpha = 1 - age;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(r.x, r.y, radius + 4 + e * 46, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
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
  const reduced = reducedMotion;
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
