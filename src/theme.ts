/**
 * Colour themes. Each palette is a dark base plus two accents (light mode derives a paper version):
 * `accent` does almost all the work (script, numbers band, BUY key, screen highlights),
 * `accent2` is the rare second colour (SELL key, asks, hover details).
 * Everything that draws colour (CSS, the 3D materials, the screen programs, the trail)
 * reads from the active theme and listens for `themechange`.
 */
export interface Theme {
  id: string;
  name: string;
  bg: string;
  raise: string;
  ink: string;
  dim: string;
  faint: string;
  line: string;
  accent: string;
  onAccent: string;
  accent2: string;
  light: boolean;
}

// order = order of the swatches; Ice is the default
export const themes: Theme[] = [
  {
    id: 'ice',
    name: 'Ice',
    bg: '#06080b',
    raise: '#0f141a',
    ink: '#eef4f8',
    dim: '#98a4ad',
    faint: '#505a62',
    line: 'rgba(238,244,248,0.14)',
    accent: '#3df6ff',
    onAccent: '#06080b',
    accent2: '#ff5ab8',
    light: false,
  },
  {
    id: 'violet',
    name: 'Violet',
    bg: '#09070d',
    raise: '#13101a',
    ink: '#f3effa',
    dim: '#a49eb0',
    faint: '#585268',
    line: 'rgba(243,239,250,0.14)',
    accent: '#b98cff',
    onAccent: '#09070d',
    accent2: '#7dffc8',
    light: false,
  },
  {
    id: 'acid',
    name: 'Acid',
    bg: '#0a0a0a',
    raise: '#141414',
    ink: '#f5f5f0',
    dim: '#a3a39b',
    faint: '#5c5c57',
    line: 'rgba(245,245,240,0.14)',
    accent: '#d4ff3a',
    onAccent: '#0a0a0a',
    accent2: '#ff8a9e',
    light: false,
  },
  {
    id: 'ember',
    name: 'Ember',
    bg: '#0c0908',
    raise: '#17110f',
    ink: '#f7efe8',
    dim: '#ab9f97',
    faint: '#5f5550',
    line: 'rgba(247,239,232,0.14)',
    accent: '#ff5a1f',
    onAccent: '#0c0908',
    accent2: '#ffb4c8',
    light: false,
  },
];

const KEY = 'msr-theme';
const CUSTOM = 'msr-theme-custom';

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* ---------- random pairs that belong together ---------- */
// OKLCH -> sRGB hex, pulling chroma in until the colour fits the gamut
function oklch(L: number, C: number, h: number): string {
  for (let c = C; c >= 0; c -= 0.005) {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return (
        '#' +
        lin
          .map((v) => {
            const x = Math.min(1, Math.max(0, v));
            const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
            return Math.round(g * 255)
              .toString(16)
              .padStart(2, '0');
          })
          .join('')
      );
    }
  }
  return '#808080';
}

function toOklch(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/**
 * The same palette on a light page: a warm-neutral paper tinted with the main hue, near-black
 * text, and both accents pulled down in lightness so they still read as text on paper.
 */
function toLight(t: Theme): Theme {
  const [, c1, h1] = toOklch(t.accent);
  const [, c2, h2] = toOklch(t.accent2);
  const ink = oklch(0.2, 0.012, h1);
  const n = parseInt(ink.slice(1), 16);
  return {
    ...t,
    bg: oklch(0.955, 0.008, h1),
    raise: oklch(0.925, 0.01, h1),
    ink,
    dim: oklch(0.44, 0.014, h1),
    faint: oklch(0.66, 0.012, h1),
    line: `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.14)`,
    accent: oklch(0.62, Math.max(0.13, Math.min(c1, 0.2)), h1),
    onAccent: ink,
    accent2: oklch(0.6, Math.max(0.12, Math.min(c2, 0.19)), h2),
    light: true,
  };
}

/**
 * A dark theme from one random hue and a partner picked by a colour-wheel rule
 * (complementary, split-complementary, triadic or analogous). Both accents stay light enough
 * to read on the dark base; the base and the text carry a faint tint of the main hue.
 */
export function randomTheme(): Theme {
  const h1 = Math.random() * 360;
  const rules = [180, 150, 210, 120, 240, 40, -40];
  const h2 = (h1 + rules[Math.floor(Math.random() * rules.length)] + (Math.random() * 16 - 8) + 360) % 360;
  const bg = oklch(0.15, 0.014, h1);
  const ink = oklch(0.97, 0.01, h1);
  const n = parseInt(ink.slice(1), 16);
  return {
    id: 'random',
    name: 'Shuffled',
    bg,
    raise: oklch(0.2, 0.018, h1),
    ink,
    dim: oklch(0.74, 0.018, h1),
    faint: oklch(0.47, 0.016, h1),
    line: `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.14)`,
    accent: oklch(0.85, 0.21, h1),
    onAccent: bg,
    accent2: oklch(0.74, 0.18, h2),
    light: false,
  };
}

function storedCustom(): Theme | null {
  try {
    const t = JSON.parse(stored(CUSTOM) ?? 'null');
    return t && t.id === 'random' ? (t as Theme) : null;
  } catch {
    return null;
  }
}

const MODE = 'msr-mode';
const saved = stored(KEY);
let palette: Theme =
  (saved === 'random' && storedCustom()) || themes.find((t) => t.id === saved) || themes[0];
/** dark or light page; any palette works in either. The old Paper theme becomes Ice on light. */
export let mode: 'dark' | 'light' =
  stored(MODE) === 'light' || saved === 'paper' ? 'light' : 'dark';
/** the colours actually on screen (palette run through the mode) */
export let current: Theme = mode === 'light' ? toLight(palette) : palette;

export function applyTheme(which: string | Theme, nextMode: 'dark' | 'light' = mode) {
  if (typeof which !== 'string') palette = which;
  else palette = themes.find((t) => t.id === which) ?? ((which === 'random' && storedCustom()) || palette);
  mode = nextMode;
  current = mode === 'light' ? toLight(palette) : palette;
  const r = document.documentElement;
  const s = r.style;
  s.setProperty('--bg', current.bg);
  s.setProperty('--bg-raise', current.raise);
  s.setProperty('--ink', current.ink);
  s.setProperty('--ink-dim', current.dim);
  s.setProperty('--ink-faint', current.faint);
  s.setProperty('--line', current.line);
  s.setProperty('--lime', current.accent);
  s.setProperty('--lime-ink', current.onAccent);
  s.setProperty('--pink', current.accent2);
  // small accent-coloured text: on paper it needs a darker shade of the accent to stay readable
  const [, tc, th] = toOklch(current.accent);
  s.setProperty('--lime-text', current.light ? oklch(0.5, Math.max(0.12, Math.min(tc, 0.18)), th) : current.accent);
  r.dataset.theme = current.id;
  r.classList.toggle('is-light', current.light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current.bg);
  try {
    localStorage.setItem(KEY, palette.id);
    localStorage.setItem(MODE, mode);
    if (palette.id === 'random') localStorage.setItem(CUSTOM, JSON.stringify(palette));
  } catch {
    /* private mode: the theme just won't persist */
  }
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: current }));
}

export function setMode(m: 'dark' | 'light') {
  applyTheme(palette, m);
}

/** "#rrggbb" + alpha -> "rgba(r,g,b,a)" */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
