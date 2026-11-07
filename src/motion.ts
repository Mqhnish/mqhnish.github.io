/**
 * One switch for all motion. It follows the system's reduce-motion setting until the visitor
 * flips the toggle in the nav, and the choice is remembered. Changing it reloads the page in place,
 * since smooth scroll, the 3D loop, the sky and the cursor all decide at start-up.
 */
const KEY = 'msr-motion';
const system = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const choice = stored();
export const reducedMotion = choice ? choice === 'off' : system;
if (reducedMotion) document.documentElement.classList.add('no-motion');

export function setMotion(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
    sessionStorage.setItem('msr-y', String(window.scrollY)); // come back to the same place
  } catch {
    /* storage blocked: the switch still applies for this load */
  }
  window.location.reload();
}

/** Scroll position saved by the last toggle, if any (read once). */
export function takeSavedScroll(): number | null {
  try {
    const y = sessionStorage.getItem('msr-y');
    sessionStorage.removeItem('msr-y');
    return y === null ? null : Number(y);
  } catch {
    return null;
  }
}
