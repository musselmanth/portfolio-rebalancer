# Portfolio Rebalancer

A browser-only calculator that turns current holdings and target percentages into the fewest broker orders needed to rebalance. It has two tools:

- **Mutual funds only**: exchanges between funds in one fund family.
- **Mixed portfolio**: stocks, ETFs and mutual funds, in three phases (sell ETFs/stocks, mutual fund orders, buy ETFs/stocks).

It can import Fidelity's positions CSV. Everything runs client-side, and saved presets live in `localStorage`.

## Develop

```sh
npm install
npm run dev       # http://localhost:5173 with live reload
npm run lint
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
```

Opening `index.html` directly from disk won't work, because browsers block ES modules on `file://`. Use `npm run dev` or `npm run preview`.

## Layout

```
index.html            page markup, including the info-popover text
src/styles.css        all styles
src/main.js           entry point: wires up each UI module in order
src/lib/              pure logic with no DOM
  planner.js          plan(): holdings + targets -> orders (all money in integer cents)
  csv.js              generic CSV parser and Fidelity positions import
  format.js           number parsing and $ / % formatting
  store.js            safe localStorage wrapper
src/ui/               DOM code, one file per area of the page
  state.js            shared state; M is the active tab ('mf' | 'etf')
  tables.js           holdings and target tables
  settings.js         cash, reserve, tolerance and option controls
  results.js          recompute(): runs the planner and renders orders
  presets.js          saved targets, JSON/CSV import and export
  csv-upload.js       positions file upload
  tabs.js, modal.js, theme.js, fit.js, clears.js, dom.js
```

## Deploy

Every push to `main` runs lint and the build in GitHub Actions, then publishes `dist/` to GitHub Pages (see `.github/workflows/deploy.yml`).
