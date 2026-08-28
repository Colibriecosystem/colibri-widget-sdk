# A Colibri widget — starter project

TypeScript + React + Vite. React is an example, not a requirement: the terminal sees a folder with
a `widget.json` and some HTML, so anything works, down to a single static file.

> Русская версия — [README.md](README.md), она же основная.

## Zero to live data

```bash
npm install
npm run build
```

Then, in the terminal: **Nest → "My widgets" → "Add widget…" → the Development card → "Load unpacked…"** and pick
the **`dist/`** folder (that one, not the project root). The terminal asks for the permissions
declared in `public/widget.json`. Accept, then press 🧩 on an empty panel and choose the widget.

You get the live best bid and ask for BTCUSDT.

## The development loop

```bash
npm run watch
```

`vite build --watch` rewrites `dist/` on every save, the terminal notices and reloads the widget —
usually well under a second. Edit `src/App.tsx` and watch.

`DevTools` on the widget's row opens Chromium DevTools against your page.

### The HMR variant

If you prefer hot module replacement:

```bash
npm run dev            # vite on localhost:5173
```

and load the **`dev/`** folder instead of `dist/` — its manifest's `entry` points at the dev server
and the terminal opens it directly. That form works only for an unpacked widget, and cannot be
packed: there is nothing to distribute.

## Layout

| Path | What it is |
|---|---|
| `public/widget.json` | the built widget's manifest; Vite copies `public/` into `dist/` |
| `dev/widget.json` | the same manifest with `entry` pointing at the dev server (load the folder) |
| `src/App.tsx` | the widget itself |
| `src/lib/colibri.js` | the SDK, vendored beside the build (see `src/lib/README.md`) |

`vite.config.ts` sets `base: "./"`, the one setting the terminal cares about: a bundled widget is
served from its own folder, so asset URLs have to be relative.

## Next

- What the API offers and how errors come back: the SDK's own README.
- A screener fetches market data **itself**, from the venue: the `markets.*` routes serve what the
  terminal has open and by construction cannot answer a whole-venue scan. List the hosts in the
  manifest's `egress`.
- When the widget is ready: **«Упаковать для «Гнезда»»** on its row produces a `.zip` plus the hash
  a listing pins.
