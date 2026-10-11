# A Colibri widget — TypeScript + React

Vite, TypeScript and React with a typed API. React is an example, not a requirement: the terminal
sees a folder with a `widget.json` and some HTML.

> Русская версия — [README.md](README.md), она же основная.

## Where this project comes from

Usually the terminal creates it: **Nest → Author → a widget → Code → From a template → TypeScript +
React**. The terminal writes the widget's ID into `public/widget.json`, `dev/widget.json`,
`dist/widget.json` and `package.json`, and loads the ready **`dist/`** build with hot reload — the
widget runs at once and shows the live best bid and ask for BTCUSDT.

Took the folder from GitHub by hand? Write your widget's ID into `public/widget.json` and
`dev/widget.json`, run `npm install` and `npm run build`, and link the `dist/` folder through
Code → Project folder.

## Editing

Node.js 20 or newer. In the project folder:

```bash
npm install
npm run watch
```

`vite build --watch` rewrites `dist/` on every save; the terminal notices and reloads the widget,
usually well under a second. Edit `src/App.tsx`. Vite's build does not check types:
`npm run typecheck` does.

DevTools on the widget's page opens Chromium DevTools against your page.

### The HMR variant

```bash
npm run dev            # Vite on localhost:5173
```

and link the **`dev/`** folder instead of `dist/`: its `entry` points at the dev server. That form
cannot be released as a version — there is nothing to distribute.

## Layout

| Path | What it is |
|---|---|
| `public/widget.json` | the manifest; Vite copies `public/` into `dist/` |
| `dev/widget.json` | the same manifest with `entry` pointing at the dev server |
| `src/App.tsx` | the widget itself |
| `src/lib/colibri.js`, `colibri.d.ts` | the SDK and its types — a copy of this repository's `sdk/` |

`vite.config.ts` sets `base: "./"`, the one setting the terminal cares about: a built widget is
served from its own folder, so asset URLs have to be relative.

## Releasing a version

Release a version on the Author tab packs the linked `dist/` folder. The terminal writes the new
number into `dist/widget.json` and into `public/` and `dev/widget.json` too, so the next build
keeps it.
