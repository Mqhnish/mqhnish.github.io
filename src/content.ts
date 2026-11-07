export type ScreenMode = 'arb' | 'shopilot' | 'marg' | 'notyet' | 'yieldgpt';

export interface Project {
  id: ScreenMode;
  name: string;
  event: string;
  pitch: string;
  body: string[];
  stats: { value: string; label: string }[];
  stack: string[];
  links: { label: string; href: string }[];
}

export const projects: Project[] = [
  {
    id: 'arb',
    name: 'ArbPercept',
    event: 'Optiver Perceptron 2026 · Problem 6',
    pitch: 'An arbitrage is only worth taking if it is still there when your order lands.',
    body: [
      'It measures how fast crypto price gaps between Bybit, Binance and OKX close and predicts whether a gap will survive a given latency. Then it decides how much thinking it can afford: act on a fast check, wait for a slower model, or skip.',
      'A six-feature logistic model screens each gap in 1.5 µs. Cases it can\'t decide go to a gradient-boosted model on Kalman, OU half-life and order-flow features, calibrated with isotonic regression and compiled to a Numba tree walker.',
      'The replay engine injects latency and models IOC legs, fees, partial-fill leg risk and an inventory cap. A lookahead test cuts the raw feeds at every decision point and checks that no decision changes, so no future data leaks in.',
    ],
    stats: [
      { value: '6.4 µs', label: 'slow-path inference' },
      { value: '10 ms', label: 'live order-book recorder' },
      { value: '3', label: 'venues' },
    ],
    stack: ['Python', 'Numba', 'gradient boosting', 'Kalman / OU', 'pytest + CI', 'systemd'],
    links: [{ label: 'Code', href: 'https://github.com/mqhnish/arbpercept' }],
  },
  {
    id: 'shopilot',
    name: 'Shopilot',
    event: 'TikTok TechJam 2026 · team lead of 5',
    pitch: 'A shopping agent that picks each question by how much it will learn.',
    body: [
      'Finds a hidden target in a 50,000-product catalog in a few turns. Every turn it decides whether to recommend or ask one more question, and chooses that question by expected information gain.',
      'Three retrieval methods (exact phrase, BM25 and TF-IDF) are blended, with different weights for each kind of request. It uses only the Python standard library: no LLM calls, no network, 39 ms a session.',
    ],
    stats: [
      { value: '1.000', label: 'hit rate@10 over 200 sessions' },
      { value: '2.83', label: 'average turns, 10 allowed' },
      { value: '8.9×', label: 'the official baseline score' },
    ],
    stack: ['Python stdlib', 'BM25', 'TF-IDF', 'information gain', '261 tests'],
    links: [
      { label: 'Code', href: 'https://github.com/mqhnish/shopilot' },
      { label: 'Demo video', href: 'https://youtu.be/fH-m0v7ZjKM' },
    ],
  },
  {
    id: 'marg',
    name: 'Marg',
    event: 'BharatCode Build League 2026 · open source',
    pitch: 'Point it at a repo. Get an onboarding guide you can trust.',
    body: [
      'A command-line agent that reads a codebase and writes ONBOARDING.md for a new developer: how to run it, the architecture, one real request traced end to end, good first tasks and a glossary.',
      'The model gets read-only tools, a step budget and a strict format. Every file:line it cites is checked against the lines it was actually shown. On the Express codebase it also caught a wrong return type in Express’s own JSDoc.',
    ],
    stats: [
      { value: '108/108', label: 'citations verified' },
      { value: '12', label: 'Indian languages it writes in' },
      { value: '0', label: 'dependencies' },
    ],
    stack: ['Python', 'LLM tool use', 'sandboxing', 'citation checks'],
    links: [{ label: 'Code', href: 'https://github.com/mqhnish/marg' }],
  },
  {
    id: 'notyet',
    name: 'Not Yet',
    event: 'Side project',
    pitch: 'The laziest schedule that still hits every deadline.',
    body: [
      'Paste in a messy to-do list. Gemma 4 reads it, then Python works out the dates and schedules each task as late as it can safely go, inside the hours you are willing to work.',
      'Then it tells you how long you can do nothing. Every task has to quote the words it came from, so a task the model made up gets flagged.',
    ],
    stats: [
      { value: '30 min', label: 'scheduling slots' },
      { value: '14 days', label: 'on one chart' },
      { value: '.ics', label: 'calendar export' },
    ],
    stack: ['Python', 'Gemma 4', 'backward scheduling', 'fact checks'],
    links: [
      { label: 'Live demo', href: 'https://not-yet-uomu.onrender.com' },
      { label: 'Code', href: 'https://github.com/mqhnish/not-yet' },
    ],
  },
  {
    id: 'yieldgpt',
    name: 'YieldGPT',
    event: 'Tencent Cloud AI Hackathon SG 2026 · FinTech track',
    pitch: 'Answers across Confluence, Jira, Slack and Drive without leaking what you can’t see.',
    body: [
      'A company knowledge assistant, built for a case set by Aspire. At answer time it checks every document against the source platform’s own permissions, and it logs every retrieval to a tamper-evident audit trail.',
      'In a team of three, I designed the connectors and the permissions layer.',
    ],
    stats: [
      { value: '4', label: 'sources' },
      { value: 'live', label: 'permission check per document' },
      { value: '3', label: 'person team' },
    ],
    stack: ['Python', 'FastAPI', 'RBAC', 'audit log'],
    links: [{ label: 'Code', href: 'https://github.com/mqhnish/YieldGPT' }],
  },
];

export const more = [
  { name: 'BiasGuard', meta: 'NYAS Junior Academy · research lead', text: 'Bias detection and mitigation for large AI systems. I led the research direction and presented it internationally.' },
  { name: 'weather-forecast-ml', meta: 'IIT Bombay Techfest · top 20', text: 'A random forest on 116k observations, R² 0.97 for temperature.', href: 'https://github.com/mqhnish/weather-forecast-ml' },
  { name: 'multimodal-toxic-detector', meta: 'Personal', text: 'Separate text, image and audio classifiers whose outputs are combined at the end (late fusion).', href: 'https://github.com/mqhnish/multimodal-toxic-detector' },
  { name: 'orbital-mechanics', meta: 'Personal', text: 'Simulations of delta-v manoeuvres and orbit transfers around the Earth and Moon.', href: 'https://github.com/mqhnish/orbital-mechanics-simulations' },
  { name: 'Vyoma and SolarGrid', meta: 'NYAS Junior Academy · co-author', text: 'Co-authored a survival guide for a Mars settlement, and a solar-energy optimisation study.' },
  { name: 'Extinction 101', meta: 'Deep Learning Week · workshop', text: 'A workshop that teaches machine learning by predicting whether an asteroid impact would cause a mass extinction.' },
];

export const experience = [
  { role: 'Business Analyst', org: 'NTU Management Consulting Club', when: '2026 –' },
  { role: 'Participant, FinTech Catalyst', org: 'NTU Quant Finance Academy', when: '2026 –' },
  { role: 'Analyst', org: 'Nanyang Student Investment Fund', when: '2026' },
  { role: 'Academics subcommittee', org: 'Deep Learning Week, MLDA @ NTU', when: '2026 –' },
  { role: 'Technical Intern', org: 'Babuda Energy', when: '2025' },
  { role: 'Technical Intern', org: 'Karandikar Laboratories', when: '2024' },
];

export const awards = [
  { role: 'Final round, 1 of 40 teams', org: 'IIT Bombay Techfest QCC', when: '' },
  { role: '3rd place, Mini Case Competition', org: 'NTU MCC', when: '2026' },
  { role: 'Bronze', org: "Queen's Commonwealth Essay Competition", when: '2025' },
  { role: 'SAT 1540 · District #1 in X and XII', org: 'Boards', when: '' },
  { role: '1st place', org: 'AFS West Zone English Debate', when: '' },
];
