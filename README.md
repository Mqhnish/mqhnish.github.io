# mqhnish.github.io

The personal site of Mohnish Singh Rawat, a computer science student at NTU. It's live at https://mqhnish.github.io.

It's built with Vite, TypeScript, Three.js, GSAP and Lenis. The 3D terminal is modelled in code (`src/terminal.ts`) and its screen is redrawn on a canvas every frame (`src/screens.ts`). The thermal and glitch effects, including the pixel mosaic on the screen, are one post-processing shader (`src/fx.ts`). The ink cursor and the dot field live in `src/trail.ts`, and the small charts in the numbers band are in `src/charts.ts`.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static site in dist/
```

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## License

All rights reserved. You're welcome to read the code, but please don't reuse the design, code or content without asking. See [LICENSE](LICENSE).
