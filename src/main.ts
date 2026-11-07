import './style.css';
import 'number-flow';
import type NumberFlow from 'number-flow';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { projects, more, experience, awards, watchlist } from './content';
import { Terminal, type Pose } from './terminal';
import { screenLabels } from './screens';
import { startTrail, startField } from './trail';
import { themes, current, applyTheme } from './theme';
import { figures } from './charts';
import { startSky } from './sky';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// colour theme first, so nothing paints in the wrong colours
applyTheme(current.id);

// always start at the top, so the hero intro and the screen program line up
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/* ---------------- render content ---------------- */
$('[data-projects]').innerHTML = projects
  .map(
    (p, i) => `
  <article class="project" data-mode="${p.id}" aria-labelledby="p-${p.id}">
    <div class="project__card">
      <p class="project__count mono reveal"><b>${String(i + 1).padStart(2, '0')}</b> / ${String(projects.length).padStart(2, '0')}</p>
      <h3 class="project__name reveal" id="p-${p.id}">${esc(p.name)}</h3>
      <p class="project__event mono reveal">${esc(p.event)}</p>
      <p class="project__pitch reveal">${esc(p.pitch)}</p>
      <div class="project__body reveal">${p.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
      <ul class="project__stats reveal" role="list">${p.stats.map((s) => `<li><b>${esc(s.value)}</b><span>${esc(s.label)}</span></li>`).join('')}</ul>
      <ul class="project__stack reveal" role="list">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <div class="project__links reveal">${p.links
        .map((l, j) => `<a class="btn ${j ? 'btn--ghost' : ''}" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} <span aria-hidden="true">↗</span></a>`)
        .join('')}</div>
    </div>
  </article>`,
  )
  .join('');

// a small drawing per card: grey at rest, it lights up in the accent and moves on hover
const glyphs = [
  // BiasGuard: two skewed distributions pulled into line
  `<path d="M4 40 C 24 40 30 8 46 8 S 70 40 92 40" class="g g--a" /><path d="M28 40 C 48 40 54 14 70 14 S 94 40 116 40" class="g g--b" />`,
  // weather-forecast-ml: points around a fitted line
  `${[[10, 34], [22, 30], [30, 32], [44, 24], [52, 27], [66, 20], [76, 18], [88, 14], [100, 12], [110, 8]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.2" class="g--dot" style="--i:${i}" />`).join('')}<path d="M4 37 L 116 7" class="g g--fit" pathLength="1" />`,
  // multimodal: three inputs fused late into one
  `<path d="M4 8 H40 C 60 8 60 24 80 24 H116" class="g" /><path d="M4 24 H116" class="g" /><path d="M4 40 H40 C 60 40 60 24 80 24" class="g" /><circle cx="80" cy="24" r="4" class="g--node" />`,
  // orbital mechanics: a transfer orbit and a craft on it
  `<g class="g--orbit"><ellipse cx="60" cy="24" rx="52" ry="17" class="g" /><circle cx="60" cy="24" r="6" class="g--node" /><circle cx="112" cy="24" r="3" class="g--sat" /></g>`,
  // Vyoma and SolarGrid: a field of panels
  `${Array.from({ length: 24 }, (_, i) => `<rect x="${4 + (i % 12) * 9.6}" y="${10 + Math.floor(i / 12) * 15}" width="7" height="11" rx="1" class="g--cell" style="--i:${i}" />`).join('')}`,
  // Extinction 101: an impactor coming in over the horizon
  `<path d="M2 44 Q 60 28 118 44" class="g" /><path d="M104 2 L 66 33" class="g g--fit" pathLength="1" /><circle cx="66" cy="34" r="3.5" class="g--node" />`,
];
$('[data-more]').innerHTML = more
  .map((m, i) => {
    const art = `<svg class="more__art" viewBox="0 0 120 48" aria-hidden="true">${glyphs[i] ?? ''}</svg>`;
    const inner = `${art}<p class="mono">${esc(m.meta)}</p><h3>${esc(m.name)}</h3><p>${esc(m.text)}</p>`;
    const cls = `more__item${i === 0 || i === 3 || i === 5 ? ' more__item--wide' : ''}`;
    return m.href
      ? `<li class="${cls}"><a class="more__in" href="${m.href}" target="_blank" rel="noopener">${inner.replace('</h3>', ' <span class="more__arrow" aria-hidden="true">↗</span></h3>')}</a></li>`
      : `<li class="${cls}"><div class="more__in">${inner}</div></li>`;
  })
  .join('');
// spotlight follows the pointer inside each card
document.querySelectorAll<HTMLElement>('.more__in').forEach((el) =>
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }),
);

$('[data-watch]').innerHTML = watchlist
  .map(
    (w, i) => `<li style="--i:${i}"><b class="mono">${w.sym}</b><span class="watch__name">${esc(w.name)}</span><span class="watch__where">${w.where
      .map((x) => `<i>${esc(x)}</i>`)
      .join('')}</span></li>`,
  )
  .join('');
ScrollTrigger.create({ trigger: '.who__grid', start: 'top 80%', once: true, onEnter: () => $('.who').classList.add('is-in') });
if (reduced) document.querySelector('.who')?.classList.add('is-in');

const rows = (list: { role: string; org: string; when: string }[]) =>
  list.map((r) => `<li><b>${esc(r.role)}</b><span>${esc(r.org)}</span>${r.when ? `<time>${esc(r.when)}</time>` : ''}</li>`).join('');
$('[data-experience]').innerHTML = rows(experience);
$('[data-awards]').innerHTML = rows(awards);

/* ---------------- smooth scroll ---------------- */
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  if (import.meta.env.DEV) (window as unknown as { __lenis: Lenis }).__lenis = lenis;
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      if (id.length < 2) return;
      e.preventDefault();
      lenis!.scrollTo(id === '#top' ? 0 : id, { duration: 1.4 });
    }),
  );
}

/* ---------------- terminal ---------------- */
let term: Terminal | null = null;
try {
  term = new Terminal($<HTMLCanvasElement>('#terminal'), reduced);
} catch {
  $('#terminal').remove(); // no WebGL: the page still reads fine without the device
}

const label = $('[data-screen-label]');
startSky();
startField();
startTrail();

if (term) {
  const t = term;
  const canvas = $<HTMLCanvasElement>('#terminal');
  t.onModeChange = (m) => (label.textContent = screenLabels[m]);
  if (import.meta.env.DEV) (window as unknown as { __term: Terminal }).__term = t;
  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    t.render(now, Math.min((now - last) / 1000, 0.05));
    last = now;
  });

  const mm = gsap.matchMedia();
  mm.add(
    { desktop: '(min-width: 821px)', mobile: '(max-width: 820px)' },
    (ctx) => {
      const { desktop } = ctx.conditions as { desktop: boolean };
      // the phone layout on a squarer window (tablet, narrow desktop pane) has room for a bigger device
      const roomy = !desktop && window.innerWidth / window.innerHeight > 0.75 ? 1.14 : 1;
      const hero: Pose = desktop
        ? { px: 0.3, py: -0.1, s: 0.9, rx: 0.14, ry: -0.5, rz: 0.08 }
        : { px: 0.03, py: roomy > 1 ? -0.24 : -0.17, s: 0.62 * roomy, rx: 0.1, ry: -0.36, rz: 0.06 };
      const work: Pose = desktop
        ? { px: 0.25, py: 0, s: 0.92, rx: 0.06, ry: -0.3, rz: 0.02 }
        : { px: 0, py: -0.24, s: 0.68 * roomy, rx: 0.05, ry: -0.16, rz: 0 };

      if (!reduced) {
        // entrance: rises in and settles, once, on load
        Object.assign(t.pose, { ...hero, py: hero.py + 0.9, ry: hero.ry - 1.6, rz: -0.3 });
        gsap.to(t.pose, { ...hero, duration: 1.8, ease: 'expo.out', delay: 0.35 });
      } else {
        Object.assign(t.pose, hero);
      }

      if (desktop) {
        // desktop: the device stays in front of the lime band the whole way through, parks in the open
        // space beside the heading, then grows into its work position as the band leaves. One move, no cut.
        const band: Pose = { px: 0.27, py: -0.02, s: 0.86, rx: 0.1, ry: -0.42, rz: 0.06 };
        ScrollTrigger.create({
          trigger: '.numbers',
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => canvas.classList.toggle('is-front', self.isActive),
        });
        gsap.fromTo(t.pose, { ...hero }, {
          ...band,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: '.numbers', start: 'top 90%', end: 'top 5%', scrub: 0.6 },
        });
        gsap.fromTo(t.pose, { ...band }, {
          ...work,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: '.numbers', start: 'bottom 85%', end: 'bottom 5%', scrub: 0.6 },
        });
      } else {
        // phones: the who section and the band run full width, so the device fades out as the who cards
        // arrive and comes back after the band, instead of being sliced
        gsap.fromTo(t.pose, { ...hero }, {
          ...work,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: '.numbers', start: 'top 80%', end: () => `+=${window.innerHeight * 1.2}`, scrub: 0.6 },
        });
        gsap.fromTo(canvas, { opacity: 1 }, {
          opacity: 0,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: '.who', start: 'top 80%', end: 'top 30%', scrub: true },
        });
        gsap.fromTo(canvas, { opacity: 0 }, {
          opacity: 1,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: '.numbers', start: 'bottom 75%', end: 'bottom 25%', scrub: true },
        });
      }

      // leaving the work section: the device sinks and fades out instead of being cut off by the next section
      gsap.fromTo(t.pose, { ...work }, {
        py: work.py - 0.35,
        ry: work.ry + 0.6,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: { trigger: '.more', start: 'top bottom', end: 'top 35%', scrub: true },
      });
      gsap.fromTo(canvas, { opacity: 1 }, {
        opacity: 0,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: { trigger: '.more', start: 'top 95%', end: 'top 45%', scrub: true },
      });

      // and comes back for the sign-off, smaller, running the contact program
      const sign: Pose = desktop
        ? { px: 0.28, py: 0.04, s: 0.78, rx: 0.1, ry: -0.42, rz: 0.05 }
        : { px: 0, py: -0.27, s: 0.46, rx: 0.08, ry: -0.24, rz: 0.03 };
      gsap.fromTo(t.pose, { ...sign, py: sign.py + 0.45, ry: sign.ry - 0.9 }, {
        ...sign,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top 15%', scrub: true },
      });
      gsap.fromTo(canvas, { opacity: 0 }, {
        opacity: 1,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: { trigger: '.contact', start: 'top 85%', end: 'top 35%', scrub: true },
      });

      document.querySelectorAll<HTMLElement>('.project').forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top center',
          end: 'bottom center',
          onToggle: (self) => {
            if (!self.isActive) return;
            const mode = el.dataset.mode as keyof typeof screenLabels;
            t.setMode(mode);
            label.textContent = screenLabels[mode];
            gsap.to(t.pose, {
              ry: work.ry + (i % 2 ? -0.22 : 0.14),
              rz: i % 2 ? -0.05 : 0.04,
              duration: 1.1,
              ease: 'expo.out',
              overwrite: 'auto',
            });
          },
        });
      });
    },
  );

  // back in the hero, the screen returns to the order book
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    onEnterBack: () => {
      t.setMode('arb');
      label.textContent = screenLabels.arb;
    },
  });

  // stop rendering while the opaque middle sections cover the viewport
  ScrollTrigger.create({
    trigger: '.more',
    start: 'top top',
    endTrigger: '.contact',
    end: 'top bottom',
    onToggle: (self) => (t.visible = !self.isActive),
  });

  // contact: the screen switches to the sign-off program, BUY opens mail
  ScrollTrigger.create({
    trigger: '.contact',
    start: 'top 70%',
    onEnter: () => {
      t.setMode('hello');
      label.textContent = screenLabels.hello;
    },
  });
  t.onSayHi = () => (window.location.href = 'mailto:mohnishsinghrawat@gmail.com');
}

/* ---------------- ticker ---------------- */
const tape = [
  ['ARBPERCEPT', '6.4 µs', 'up', 'slow-path inference'],
  ['MARG', '108/108', 'up', 'citations checked'],
  ['SHOPILOT', '8.9×', 'up', 'the baseline score'],
  ['SHOPILOT', '2.83', 'up', 'turns to find it'],
  ['WEATHER', 'R² 0.97', 'up', '116k observations'],
  ['ARBPERCEPT', '1.5 µs', 'up', 'first-pass screen'],
  ['SHOPILOT', '39 ms', 'up', 'per session'],
  ['TECHFEST QCC', 'final round', 'up', 'one of 40 teams'],
  ['SGT', '', 'dn', ''],
];
const tapeHTML = tape
  .map(([k, v, d, l]) => (k === 'SGT' ? `<span>SGT <b data-sgt>--:--</b></span>` : `<span><b>${k}</b> <i class="${d}">● ${v}</i> ${l}</span>`))
  .join('');
$('[data-ticker]').innerHTML = tapeHTML + tapeHTML;
const sgt = () => {
  const now = new Date();
  const hm = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' });
  document.querySelectorAll('[data-sgt]').forEach((e) => (e.textContent = hm));
  document.querySelectorAll('[data-sgt-full]').forEach(
    (e) => (e.textContent = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false }) + ' SGT'),
  );
};
sgt();
setInterval(sgt, 1000);
// months since the move (August 2026), so the spec sheet never goes stale
{
  const n = new Date();
  const months = Math.max(0, (n.getFullYear() - 2026) * 12 + n.getMonth() - 7);
  document.querySelectorAll('[data-months]').forEach((e) => (e.textContent = months <= 1 ? 'since August 2026' : `${months} months, since August 2026`));
}

/* ---------------- hero type ---------------- */
const word = $('.hero__word');
const wipe = $<SVGRectElement>('.hero__wipe');
const swash = $<SVGPathElement>('.hero__swash');

document.fonts.ready.then(() => {
  if (reduced) {
    gsap.set(wipe, { attr: { width: 520 } });
    return;
  }
  const split = SplitText.create(word, { type: 'chars', charsClass: 'ch', mask: 'chars' });
  gsap.set(swash, { strokeDashoffset: 1 });
  gsap
    .timeline({ delay: 0.15 })
    // letters rise in condensed and stretch out to full width as they land
    .from(split.chars, {
      yPercent: 110,
      fontVariationSettings: "'wdth' 62",
      duration: 1.2,
      ease: 'expo.out',
      stagger: 0.045,
    })
    // then the signature writes itself, and the flourish is drawn under it
    .fromTo(wipe, { attr: { width: 0 } }, { attr: { width: 520 }, duration: 1.1, ease: 'power2.inOut' }, '-=0.6')
    .to(swash, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.25')
    .from('.hero__lede, .hero__foot, .hero__tag', { y: 16, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, '-=0.9');

  // wordmark drifts up and spreads slightly as you leave the hero
  gsap.to(word, {
    yPercent: -28,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__script', {
    yPercent: -60,
    rotate: -4,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
});

/* ---------------- theme picker ---------------- */
const picker = $('[data-themes]');
picker.insertAdjacentHTML(
  'beforeend',
  themes
    .map(
      (t) =>
        `<button class="swatch" role="radio" aria-label="${t.name} theme" title="${t.name}" data-theme-id="${t.id}" style="--a:${t.accent};--b:${t.light ? t.bg : t.accent2}"></button>`,
    )
    .join(''),
);
const syncPicker = () =>
  picker.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => {
    const on = b.dataset.themeId === current.id;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
syncPicker();
picker.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.swatch');
  if (!b) return;
  applyTheme(b.dataset.themeId!);
  syncPicker();
});
picker.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = themes.findIndex((t) => t.id === current.id);
  const next = themes[(i + (e.key === 'ArrowRight' ? 1 : themes.length - 1)) % themes.length];
  applyTheme(next.id);
  syncPicker();
  picker.querySelector<HTMLButtonElement>(`[data-theme-id="${next.id}"]`)?.focus();
  e.preventDefault();
});

/* ---------------- nav: frosted once scrolled, hides while reading down ---------------- */
const nav = $('.nav');
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => {
    const y = self.scroll();
    nav.classList.toggle('is-scrolled', y > 40);
    const hide = self.direction === 1 && y > window.innerHeight * 0.6 && !nav.contains(document.activeElement);
    nav.classList.toggle('is-hidden', hide);
  },
});
ScrollTrigger.create({
  trigger: '.numbers',
  start: () => `top ${nav.offsetHeight / 2}px`,
  end: () => `bottom ${nav.offsetHeight / 2}px`,
  onToggle: (self) => nav.classList.toggle('is-on-lime', self.isActive),
});

/* ---------------- numbers ---------------- */
document.querySelectorAll('.numbers__grid li').forEach((li, i) => figures[i] && li.insertAdjacentHTML('beforeend', figures[i]()));
ScrollTrigger.create({
  trigger: '.numbers__grid',
  start: 'top 75%',
  once: true,
  onEnter: () => $('.numbers__grid').classList.add('is-in'),
});
const flows = [...document.querySelectorAll<NumberFlow>('number-flow')];
flows.forEach((f) => {
  const d = Number(f.dataset.decimals ?? 0);
  f.format = { minimumFractionDigits: d, maximumFractionDigits: d };
  f.update(reduced ? Number(f.dataset.to) : 0);
});
if (!reduced) {
  ScrollTrigger.create({
    trigger: '.numbers__grid',
    start: 'top 80%',
    once: true,
    onEnter: () => flows.forEach((f, i) => setTimeout(() => f.update(Number(f.dataset.to)), i * 120)),
  });
}

/* ---------------- reveals ---------------- */
if (!reduced) {
  document.querySelectorAll<HTMLElement>('.project__card').forEach((card) => {
    gsap.from(card.querySelectorAll('.reveal'), {
      y: 28,
      opacity: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: { trigger: card, start: 'top 75%', once: true },
    });
  });
  gsap.from('.more__grid li', {
    y: 24,
    opacity: 0,
    duration: 0.8,
    ease: 'expo.out',
    stagger: 0.05,
    scrollTrigger: { trigger: '.more__grid', start: 'top 80%', once: true },
  });
}

/* ---------------- about: words light up as you read ---------------- */
const lit = $('[data-lit]');
const hot = ['40', 'milliseconds,', 'expected', 'value'];
lit.innerHTML = lit.textContent!
  .trim()
  .split(/\s+/)
  .map((w) => `<span class="w${hot.includes(w) ? ' hot' : ''}">${esc(w)}</span>`)
  .join(' ');
if (!reduced) {
  const words = [...lit.querySelectorAll('.w')];
  ScrollTrigger.create({
    trigger: lit,
    start: 'top 80%',
    end: 'bottom 45%',
    onUpdate: (self) => {
      const n = Math.round(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    },
  });
} else {
  lit.querySelectorAll('.w').forEach((w) => w.classList.add('on'));
}

window.addEventListener('load', () => ScrollTrigger.refresh());
