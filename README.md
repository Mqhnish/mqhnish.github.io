# mqhnish.github.io

Personal site of Mohnish Singh Rawat, CS at NTU. Live at https://mqhnish.github.io

Built with Vite, TypeScript, Three.js, GSAP and Lenis. The 3D terminal in the hero is modelled in code (`src/terminal.ts`), its screen is drawn on a canvas each frame (`src/screens.ts`), and the thermal and glitch effects are one post-processing shader (`src/fx.ts`).

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static site in dist/
```

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## License

All rights reserved. You're welcome to read the code, but please don't reuse the design, code or content without asking. See [LICENSE](LICENSE).
