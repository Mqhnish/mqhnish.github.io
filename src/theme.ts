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

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export let current: Theme = themes.find((t) => t.id === stored()) ?? themes[0];

export function applyTheme(id: string) {
  current = themes.find((t) => t.id === id) ?? themes[0];
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
  } catch {
    /* private mode: the theme just won't persist */
  }
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: current }));
}

/** "#rrggbb" + alpha → "rgba(r,g,b,a)" */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
