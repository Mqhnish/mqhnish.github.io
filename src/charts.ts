/**
 * Small figures under each number in the lime band. Each one draws only what the number says,
 * nothing invented: a log axis for the latency drop, every verified citation as a square,
 * the speed-up as two bars, the turn budget as ten slots, R² as a share of variance.
 * Marks use currentColor (the band's ink), so they follow every theme.
 */
const W = 240;
const H = 64;
const LBL = 'class="fig__lbl"';

const svg = (label: string, body: string) =>
  `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;

// 1 µs .. 100 ms on a log axis, 48 px a decade
const lx = (us: number) => 48 * Math.log10(us);

function latency() {
  const a = lx(3000);
  const b = lx(28000);
  const now = lx(6.4);
  const ticks = [1, 10, 100, 1000, 10000, 100000]
    .map((v) => `<line x1="${lx(v)}" x2="${lx(v)}" y1="44" y2="48" />`)
    .join('');
  return svg(
    'Log scale: slow path went from 3 to 28 milliseconds down to 6.4 microseconds',
    `<g class="fig__axis"><line x1="0" x2="${W}" y1="44" y2="44" />${ticks}</g>
     <text ${LBL} x="0" y="60">1µs</text><text ${LBL} x="${lx(1000)}" y="60" text-anchor="middle">1ms</text><text ${LBL} x="${W}" y="60" text-anchor="end">100ms</text>
     <rect class="fig__ghost fig__grow" x="${a}" y="30" width="${b - a}" height="8" rx="4" />
     <text ${LBL} x="${(a + b) / 2}" y="22" text-anchor="middle">before</text>
     <path class="fig__draw" pathLength="1" d="M ${a - 4} 34 L ${now + 8} 34" />
     <path class="fig__draw" pathLength="1" d="M ${now + 14} 29 L ${now + 8} 34 L ${now + 14} 39" />
     <circle class="fig__pop" cx="${now}" cy="34" r="5" />
     <text ${LBL} x="${now}" y="22" text-anchor="middle">now</text>`,
  );
}

function citations() {
  // 108 squares, 27 × 4, every one verified
  let sq = '';
  for (let i = 0; i < 108; i++) {
    const x = (i % 27) * 8.9;
    const y = 6 + Math.floor(i / 27) * 9;
    sq += `<rect class="fig__pop" style="--i:${i}" x="${x}" y="${y}" width="6.4" height="6.4" rx="1.2" />`;
  }
  return svg('108 of 108 citations verified', `${sq}<text ${LBL} x="0" y="60">each square: one citation, checked</text>`);
}

function speedup() {
  const full = W - 4;
  return svg(
    'Shopilot scores 8.9 times the official baseline',
    `<rect class="fig__ghost fig__grow" x="0" y="10" width="${full / 8.9}" height="10" rx="4" />
     <text ${LBL} x="${full / 8.9 + 6}" y="19">baseline 1×</text>
     <rect class="fig__solid fig__grow" x="0" y="30" width="${full}" height="10" rx="4" />
     <text ${LBL} x="0" y="60">shopilot 8.9×</text>`,
  );
}

function turns() {
  // ten slots, 2.83 of them used on average
  const slot = 22.4;
  let s = '';
  for (let i = 0; i < 10; i++) {
    const x = i * (slot + 1.6);
    const used = Math.max(0, Math.min(1, 2.83 - i));
    s += `<rect class="fig__ghost" x="${x}" y="22" width="${slot}" height="12" rx="3" />`;
    if (used > 0) s += `<rect class="fig__solid fig__grow" style="--i:${i}" x="${x}" y="22" width="${slot * used}" height="12" rx="3" />`;
  }
  return svg(
    'On average 2.83 of the 10 allowed turns are used',
    `${s}<text ${LBL} x="0" y="14">used</text><text ${LBL} x="${W}" y="60" text-anchor="end">budget: 10 turns</text>`,
  );
}

function rsq() {
  const full = W;
  const ex = full * 0.97;
  return svg(
    'R squared 0.97: 97 percent of the variance explained, 3 percent left',
    `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" class="fig__hatch" /></pattern></defs>
     <rect class="fig__solid fig__grow" x="0" y="22" width="${ex - 1}" height="12" rx="3" />
     <rect x="${ex + 1}" y="22" width="${full - ex - 1}" height="12" rx="2" fill="url(#hatch)" class="fig__hatchbox" />
     <text ${LBL} x="0" y="14">variance explained</text>
     <text ${LBL} x="${W}" y="52" text-anchor="end">3% left</text>`,
  );
}

export const figures = [latency, citations, speedup, turns, rsq];
