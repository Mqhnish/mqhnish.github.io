import { rgba } from './theme';
import type { ScreenMode } from './content';

/**
 * Draws the terminal's screen into a 2D canvas, one "program" per project.
 * The canvas becomes a Three.js texture, so everything here is plain 2D drawing.
 */

export const SCREEN_W = 800;
export const SCREEN_H = 560;
const RES = 2;

// screen colours follow the active theme; the screen itself always stays dark
let LIME = '#d4ff3a';
let PINK = '#ff8a9e';
const INK = '#eef1e6';
const DIM = 'rgba(238,241,230,0.62)';
const FAINT = 'rgba(238,241,230,0.14)';

export function setScreenTheme(accent: string, accent2: string) {
  LIME = accent;
  PINK = accent2;
}
const BG = '#040506';
const MONO = '600 27px "JetBrains Mono", ui-monospace, monospace';
const MONO_SM = '400 21px "JetBrains Mono", ui-monospace, monospace';
const MONO_LG = '600 66px "JetBrains Mono", ui-monospace, monospace';

type Ctx = CanvasRenderingContext2D;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function header(c: Ctx, left: string, right: string) {
  c.font = MONO_SM;
  c.fillStyle = DIM;
  c.textAlign = 'left';
  c.fillText(left, 28, 40);
  c.textAlign = 'right';
  c.fillText(right, SCREEN_W - 28, 40);
  c.textAlign = 'left';
  c.fillStyle = FAINT;
  c.fillRect(28, 54, SCREEN_W - 56, 1);
}

/* ---------------- ArbPercept: two books, a spread chart, decisions ---------------- */
const arb = {
  spread: Array.from({ length: 120 }, () => 0),
  t: 0,
  decisions: [] as { txt: string; col: string }[],
  lastDecision: 0,
};

function drawArb(c: Ctx, time: number) {
  header(c, 'arbpercept.live  BTC-PERP', 'bybit ⇄ binance');
  arb.t += 1;
  const last = arb.spread[arb.spread.length - 1];
  const shock = Math.random() < 0.02 ? rand(-1.6, 1.6) : 0;
  arb.spread.push(last * 0.93 + rand(-0.22, 0.22) + shock);
  arb.spread.shift();

  // order books
  const mid = 67412.5 + Math.sin(time * 0.0004) * 6;
  const col = (x: number, title: string, skew: number) => {
    c.font = MONO_SM;
    c.fillStyle = DIM;
    c.fillText(title, x, 88);
    for (let i = 0; i < 5; i++) {
      const ask = mid + skew + (5 - i) * 0.5;
      const w = 40 + 90 * Math.abs(Math.sin(time * 0.002 + i * 1.7 + skew));
      c.fillStyle = rgba(PINK, 0.16);
      c.fillRect(x + 220 - w, 100 + i * 26, w, 20);
      c.fillStyle = PINK;
      c.fillText(ask.toFixed(1), x, 116 + i * 26);
    }
    for (let i = 0; i < 5; i++) {
      const bid = mid + skew - (i + 1) * 0.5;
      const w = 40 + 90 * Math.abs(Math.cos(time * 0.0023 + i * 1.3 - skew));
      c.fillStyle = rgba(LIME, 0.14);
      c.fillRect(x + 220 - w, 236 + i * 26, w, 20);
      c.fillStyle = LIME;
      c.fillText(bid.toFixed(1), x, 252 + i * 26);
    }
  };
  col(28, 'BYBIT', 0);
  col(300, 'BINANCE', arb.spread[arb.spread.length - 1] * 0.5);

  // spread chart
  const cx = 560,
    cy = 80,
    cw = 212,
    ch = 300;
  c.fillStyle = FAINT;
  c.fillRect(cx, cy + ch / 2, cw, 1);
  c.strokeStyle = LIME;
  c.lineWidth = 2.5;
  c.beginPath();
  arb.spread.forEach((v, i) => {
    const x = cx + (i / (arb.spread.length - 1)) * cw;
    const y = cy + ch / 2 - v * 60;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.stroke();
  c.font = MONO_SM;
  c.fillStyle = DIM;
  c.fillText('spread, bps', cx, cy + ch + 24);

  // decisions every ~0.9s
  if (time - arb.lastDecision > 900) {
    arb.lastDecision = time;
    const q = Math.random();
    const edge = rand(0.4, 3.2);
    const ev = q * (edge - 1.1) + (1 - q) * -1.8;
    const verdict = q > 0.72 ? 'ACT ' : q < 0.3 ? 'SKIP' : 'SLOW';
    arb.decisions.unshift({
      txt: `q=${q.toFixed(2)}  edge=${edge.toFixed(1)}  EV=${ev >= 0 ? '+' : ''}${ev.toFixed(2)}bps  → ${verdict}`,
      col: verdict === 'ACT ' ? LIME : verdict === 'SKIP' ? PINK : INK,
    });
    arb.decisions.length = Math.min(arb.decisions.length, 3);
  }
  c.fillStyle = FAINT;
  c.fillRect(28, 410, SCREEN_W - 56, 1);
  c.font = MONO_SM;
  arb.decisions.forEach((d, i) => {
    c.globalAlpha = 1 - i * 0.3;
    c.fillStyle = d.col;
    c.fillText(d.txt, 28, 444 + i * 28);
  });
  c.globalAlpha = 1;
  c.font = MONO;
  c.fillStyle = LIME;
  c.textAlign = 'right';
  c.fillText('6.4 µs', SCREEN_W - 28, 444);
  c.textAlign = 'left';
}

/* ---------------- Shopilot: a chat narrowing 50,000 products ---------------- */
const shopScript = [
  { who: 'you', txt: 'running shoes, something light' },
  { who: 'bot', txt: 'road or trail?', n: 1204 },
  { who: 'you', txt: 'road. under $90' },
  { who: 'bot', txt: 'need wide fit?', n: 38 },
  { who: 'you', txt: 'yes' },
  { who: 'bot', txt: 'found it  → rank 1', n: 1 },
];

function drawShop(c: Ctx, time: number) {
  header(c, 'shopilot  session 117/200', 'info-gain questions');
  const cycle = 9000;
  const t = time % cycle;
  const shown = Math.min(shopScript.length, Math.floor(t / 1200) + 1);
  let n = 50000;
  for (let i = 0; i < shown; i++) {
    const m = shopScript[i];
    if (m.n) n = m.n;
    const y = 100 + i * 54;
    const you = m.who === 'you';
    c.font = MONO;
    const w = c.measureText(m.txt).width + 32;
    const x = you ? SCREEN_W - 28 - w : 28;
    c.fillStyle = you ? 'rgba(233,240,216,0.08)' : rgba(LIME, 0.12);
    c.beginPath();
    c.roundRect(x, y - 33, w, 46, 12);
    c.fill();
    c.fillStyle = you ? INK : LIME;
    c.fillText(m.txt, x + 16, y);
  }
  c.fillStyle = FAINT;
  c.fillRect(28, 430, SCREEN_W - 56, 1);
  c.font = MONO_SM;
  c.fillStyle = DIM;
  c.fillText('candidates', 28, 468);
  c.fillText('turn', 420, 468);
  c.font = MONO_LG;
  c.fillStyle = n === 1 ? LIME : INK;
  c.fillText(n.toLocaleString('en-US'), 28, 528);
  c.fillStyle = INK;
  c.fillText(`${Math.ceil(shown / 2)}/10`, 420, 528);
}

/* ---------------- Marg: typing a guide, citations ticking ---------------- */
const margLines = [
  '## Architecture',
  'Requests enter at lib/express.js:41',
  'Router dispatch  lib/router/index.js:136',
  'Params parsed in lib/router/layer.js:110',
  '## One real flow: GET /users/:id',
  'res.send sets ETag  lib/response.js:207',
  '## Gotcha',
  'req.query JSDoc return type is wrong',
  '  lib/request.js:283',
];

function drawMarg(c: Ctx, time: number) {
  header(c, '$ marg guide ./express', 'qwen-3.8-27b');
  const cycle = 11000;
  const t = time % cycle;
  const chars = Math.floor(t / 24);
  let left = chars;
  let verified = 0;
  c.font = MONO_SM;
  for (let i = 0; i < margLines.length; i++) {
    if (left <= 0) break;
    const line = margLines[i];
    const vis = line.slice(0, left);
    left -= line.length;
    const y = 92 + i * 34;
    const isHead = line.startsWith('##');
    c.fillStyle = isHead ? LIME : INK;
    c.font = isHead ? MONO : MONO_SM;
    c.fillText(vis, 28, y);
    if (vis.length === line.length && /:\d+$/.test(line)) {
      verified++;
      c.fillStyle = LIME;
      c.fillText('✓', SCREEN_W - 52, y);
    }
    if (vis.length < line.length && Math.floor(time / 400) % 2) {
      c.fillStyle = LIME;
      c.fillRect(28 + c.measureText(vis).width + 4, y - 18, 12, 22);
    }
  }
  const total = Math.min(108, Math.round((t / (cycle * 0.85)) * 108));
  c.fillStyle = FAINT;
  c.fillRect(28, 430, SCREEN_W - 56, 1);
  c.font = MONO_SM;
  c.fillStyle = DIM;
  c.fillText('citations verified', 28, 468);
  c.fillText(`${verified} shown on screen`, 420, 468);
  c.font = MONO_LG;
  c.fillStyle = LIME;
  c.fillText(`${total}/108`, 28, 528);
  c.fillStyle = PINK;
  c.font = MONO;
  c.fillText('0 unverified', 420, 524);
}

/* ---------------- Not Yet: blocks sliding as late as they can go ---------------- */
const tasks = [
  { d: 9, len: 2, col: 'a' },
  { d: 11, len: 1, col: 'b' },
  { d: 12, len: 3, col: 'a' },
  { d: 6, len: 1, col: 'i' },
  { d: 13, len: 2, col: 'b' },
];

function drawNotYet(c: Ctx, time: number) {
  header(c, 'not yet  next 14 days', 'relax-until');
  const gx = 28,
    gy = 80,
    cell = (SCREEN_W - 56) / 14;
  for (let d = 0; d < 14; d++) {
    c.fillStyle = d % 7 >= 5 ? 'rgba(233,240,216,0.05)' : 'rgba(233,240,216,0.025)';
    c.fillRect(gx + d * cell + 2, gy, cell - 4, 300);
    c.font = MONO_SM;
    c.fillStyle = DIM;
    c.fillText(String(8 + d), gx + d * cell + 10, gy + 326);
  }
  const p = (Math.sin(time * 0.0009) + 1) / 2; // slide between "early" and "as late as possible"
  const ease = p * p * (3 - 2 * p);
  tasks.forEach((tk, i) => {
    const early = i * 1.2;
    const day = early + (tk.d - tk.len - early) * ease;
    const x = gx + day * cell + 3;
    c.fillStyle = tk.col === 'a' ? LIME : tk.col === 'b' ? PINK : INK;
    c.beginPath();
    c.roundRect(x, gy + 20 + i * 54, tk.len * cell - 6, 40, 8);
    c.fill();
  });
  // free stretch shading
  const freeTo = gx + (5 + 0.6 * ease) * cell;
  c.fillStyle = rgba(LIME, 0.08);
  c.fillRect(gx, gy, freeTo - gx, 300);
  c.fillStyle = FAINT;
  c.fillRect(28, 430, SCREEN_W - 56, 1);
  c.font = MONO_SM;
  c.fillStyle = DIM;
  c.fillText('you can do nothing for', 28, 468);
  c.fillText('sloth days', 520, 468);
  c.font = MONO_LG;
  c.fillStyle = LIME;
  const hrs = Math.round(48 + 74 * ease);
  c.fillText(`${hrs} h`, 28, 528);
  c.fillStyle = INK;
  c.fillText(String(ease > 0.5 ? 4 : 2), 520, 528);
}

/* ---------------- YieldGPT: permission checks and an audit chain ---------------- */
const sources = ['confluence/finance-q3', 'jira/RISK-412', 'slack/#treasury', 'drive/board-pack.pdf'];

function drawYield(c: Ctx, time: number) {
  header(c, 'yieldgpt  user: analyst', 'audit: on');
  c.font = MONO;
  c.fillStyle = INK;
  c.fillText('> what changed in our FX hedge policy?', 28, 98);
  const step = Math.floor((time % 6000) / 700);
  sources.forEach((s, i) => {
    if (i > step) return;
    const ok = i !== 3;
    const y = 160 + i * 52;
    c.font = MONO_SM;
    c.fillStyle = ok ? LIME : PINK;
    c.fillText(ok ? 'ALLOW' : 'DENY ', 28, y);
    c.fillStyle = ok ? INK : DIM;
    c.fillText(s, 128, y);
    c.fillStyle = DIM;
    c.textAlign = 'right';
    c.fillText(ok ? 'native acl ✓' : 'not shared', SCREEN_W - 28, y);
    c.textAlign = 'left';
  });
  c.fillStyle = FAINT;
  c.fillRect(28, 430, SCREEN_W - 56, 1);
  c.font = MONO_SM;
  c.fillStyle = DIM;
  c.fillText('audit chain', 28, 468);
  c.font = MONO;
  for (let i = 0; i < 4; i++) {
    const h = ((Math.floor(time / 700) + i) * 2654435761) >>> 0;
    c.fillStyle = i === 0 ? LIME : DIM;
    c.fillText(h.toString(16).padStart(8, '0').slice(0, 6), 28 + i * 140, 520);
    if (i < 3) {
      c.fillStyle = FAINT;
      c.fillText('→', 128 + i * 140, 520);
    }
  }
}

const programs: Record<ScreenMode, (c: Ctx, t: number) => void> = {
  arb: drawArb,
  shopilot: drawShop,
  marg: drawMarg,
  notyet: drawNotYet,
  yieldgpt: drawYield,
};

export const screenLabels: Record<ScreenMode, string> = {
  arb: 'arbpercept.live',
  shopilot: 'shopilot.session',
  marg: 'marg.guide',
  notyet: 'notyet.plan',
  yieldgpt: 'yieldgpt.audit',
};

export class Screen {
  readonly canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private mode: ScreenMode = 'arb';
  private switchAt = -1e9;

  constructor() {
    // drawn at 2x: all program code works in SCREEN_W × SCREEN_H units, the backing store is double
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_W * RES;
    this.canvas.height = SCREEN_H * RES;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(RES, RES);
  }

  private flashText = '';
  private flashSub = '';
  private flashCol = '#d4ff3a';
  private flashAt = -1e9;

  get current() {
    return this.mode;
  }

  setMode(mode: ScreenMode, now: number) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.switchAt = now;
  }

  /** Big overlay message, used when BUY / SELL are pressed. */
  flash(text: string, sub: string, color: 'lime' | 'pink', now: number) {
    this.flashText = text;
    this.flashSub = sub;
    this.flashCol = color === 'lime' ? LIME : PINK;
    this.flashAt = now;
  }

  private drawFlash(c: Ctx, now: number) {
    const age = now - this.flashAt;
    if (age > 1500) return;
    const a = age < 120 ? age / 120 : age > 1150 ? 1 - (age - 1150) / 350 : 1;
    c.globalAlpha = a;
    c.fillStyle = 'rgba(7,9,6,0.82)';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.fillStyle = this.flashCol;
    c.fillRect(28, SCREEN_H / 2 - 92, SCREEN_W - 56, 4);
    c.fillRect(28, SCREEN_H / 2 + 88, SCREEN_W - 56, 4);
    c.textAlign = 'center';
    c.font = '700 76px "JetBrains Mono", ui-monospace, monospace';
    c.fillText(this.flashText, SCREEN_W / 2, SCREEN_H / 2 + 10);
    c.font = MONO;
    c.fillStyle = INK;
    c.fillText(this.flashSub, SCREEN_W / 2, SCREEN_H / 2 + 60);
    c.textAlign = 'left';
    c.globalAlpha = 1;
  }

  draw(now: number) {
    const c = this.ctx;
    c.fillStyle = BG;
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    programs[this.mode](c, now);
    this.drawFlash(c, now);

    // fine scanlines: subtle enough that text stays sharp
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < SCREEN_H; y += 3) c.fillRect(0, y, SCREEN_W, 0.75);

    // RGB-split glitch for 260ms after a program switch
    const since = now - this.switchAt;
    if (since < 260) {
      const k = 1 - since / 260;
      for (let i = 0; i < 7; i++) {
        const y = Math.random() * SCREEN_H;
        const h = rand(8, 60);
        const dx = rand(-40, 40) * k;
        c.drawImage(this.canvas, 0, y * RES, SCREEN_W * RES, h * RES, dx, y, SCREEN_W, h);
      }
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(PINK, 0.25 * k);
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);
      c.globalCompositeOperation = 'source-over';
    }

    // soft vignette
    const g = c.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.3, SCREEN_W / 2, SCREEN_H / 2, SCREEN_W * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.32)');
    c.fillStyle = g;
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }
}
