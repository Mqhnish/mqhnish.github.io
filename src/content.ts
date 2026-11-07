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
      'Measures how fast crypto price gaps between Bybit, Binance and OKX close, predicts whether each one survives a given latency, and decides how much thinking it can afford: act on a fast check, wait for a slower model, or skip.',
      'A six-feature logistic prior screens in 1.5 µs. Undecided cases go to gradient boosting on Kalman, OU half-life and order-flow features, calibrated with isotonic regression and compiled to a Numba tree walker.',
      'Replay engine with injected latency, IOC legs, fees, partial-fill leg risk and an inventory cap. A lookahead test cuts the raw feeds at every decision and checks that nothing changes.',
    ],
    stats: [
      { value: '6.4 µs', label: 'slow-path inference' },
      { value: '10 ms', label: 'live book recorder' },
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
      'Three retrieval routes (exact phrase, BM25, TF-IDF) fused per intent track. Standard library only: no tokens, no network, 39 ms a session.',
    ],
    stats: [
      { value: '1.000', label: 'hit rate @10, 200 sessions' },
      { value: '2.83', label: 'mean turns of 10' },
      { value: '8.9×', label: 'official baseline' },
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
      'A command-line agent that reads a codebase the way a senior engineer would on day one, then writes ONBOARDING.md: how to run it, the architecture, one real flow, first tasks and a glossary.',
      'The model gets read-only tools, a step budget and a strict format. Every file:line it cites is checked against the lines it was actually shown. On Express it even caught a wrong return type in Express’s own JSDoc.',
    ],
    stats: [
      { value: '108/108', label: 'citations verified' },
      { value: '12', label: 'Indian languages' },
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
      'Paste your to-do brain dump. Gemma 4 reads it, Python resolves the dates and schedules every task as late as it can safely go inside the hours you are willing to work.',
      'Then it tells you the one thing you wanted to know: how long you can do nothing. Every task has to quote the words it came from, so invented tasks get flagged.',
    ],
    stats: [
      { value: '30 min', label: 'slot scheduler' },
      { value: '14 days', label: 'on one chart' },
      { value: '.ics', label: 'one-click export' },
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
      'An enterprise knowledge assistant for a case set by Aspire. Every document is checked against the source platform’s own permissions at answer time, and every retrieval goes into a tamper-evident audit trail.',
      'I designed the connector and permissions layer in a team of three.',
    ],
    stats: [
      { value: '4', label: 'sources' },
      { value: 'live', label: 'per-doc authz' },
      { value: '3', label: 'person team' },
    ],
    stack: ['Python', 'FastAPI', 'RBAC', 'audit log'],
    links: [{ label: 'Code', href: 'https://github.com/mqhnish/YieldGPT' }],
  },
];

export const more = [
  { name: 'BiasGuard', meta: 'NYAS Junior Academy · research lead', text: 'Bias detection and mitigation for large AI systems. Presented internationally.' },
  { name: 'weather-forecast-ml', meta: 'IIT Bombay Techfest · top 20', text: 'Random forests on 116k observations. R² 0.97 for temperature.', href: 'https://github.com/mqhnish/weather-forecast-ml' },
  { name: 'multimodal-toxic-detector', meta: 'Personal', text: 'Text, image and audio classifiers combined by late fusion.', href: 'https://github.com/mqhnish/multimodal-toxic-detector' },
  { name: 'orbital-mechanics', meta: 'Personal', text: 'Delta-v manoeuvres and transfers around the Earth and Moon.', href: 'https://github.com/mqhnish/orbital-mechanics-simulations' },
  { name: 'Vyoma and SolarGrid', meta: 'NYAS Junior Academy · co-author', text: 'A systems model for a Mars settlement, and solar plan optimisation.' },
  { name: 'Extinction 101', meta: 'Deep Learning Week · workshop', text: 'Taught ML by classifying whether an asteroid impact causes extinction.' },
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
