/**
 * Colour themes. Each theme is a dark (or paper) base plus two accents:
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

export const themes: Theme[] = [
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
  {
    id: 'ice',
    name: 'Ice',
    bg: '#06080b',
    raise: '#0f141a',
    ink: '#eef4f8',
    dim: '#98a4ad',
    faint: '#505a62',
    line: 'rgba(238,244,248,0.14)',
    accent: '#6ff7ff',
    onAccent: '#06080b',
    accent2: '#ff79b8',
    light: false,
  },
  {
    id: 'paper',
    name: 'Paper',
    bg: '#ebe8e1',
    raise: '#e0ddd5',
    ink: '#0d0d0d',
    dim: '#56544f',
    faint: '#97948c',
    line: 'rgba(13,13,13,0.14)',
    accent: '#ff4a1c',
    onAccent: '#0d0d0d',
    accent2: '#ffb000',
    light: true,
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

// Ice is the default; a shuffled theme is remembered like any other
const saved = stored(KEY);
export let current: Theme =
  (saved === 'random' && storedCustom()) || themes.find((t) => t.id === saved) || themes.find((t) => t.id === 'ice')!;

export function applyTheme(which: string | Theme) {
  if (typeof which !== 'string') current = which;
  else current = themes.find((t) => t.id === which) ?? ((which === 'random' && storedCustom()) || current);
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
  r.dataset.theme = current.id;
  r.classList.toggle('is-light', current.light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current.bg);
  try {
    localStorage.setItem(KEY, current.id);
    if (current.id === 'random') localStorage.setItem(CUSTOM, JSON.stringify(current));
  } catch {
    /* private mode: the theme just won't persist */
  }
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: current }));
}

/** "#rrggbb" + alpha -> "rgba(r,g,b,a)" */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
