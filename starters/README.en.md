# Widget starters

The terminal creates a widget from these four projects by itself: **Nest → Author → a widget →
Code → From a template**. The author picks a starter and a folder; the terminal downloads the
starter from this repository's release, checks its SHA-256, writes the widget's ID into every
`widget.json` (and the package name into `package.json`), creates `<folder>\<ID>` and loads it with
hot reload.

> Русская версия — [README.md](README.md), она же основная.

| Starter | Folder | Build | The terminal loads | Permissions |
|---|---|---|---|---|
| Plain | [`plain/`](plain/) | none | `widget/` | marketData, storage |
| TypeScript + React | [`react/`](react/) | Vite | `dist/` | marketData, storage |
| Trading | [`trading/`](trading/) | Vite | `dist/` | marketData, account:read, trading, storage |
| Chart | [`chart/`](chart/) | none | `widget/` | marketData, storage |

The terminal always loads a **subfolder**, never the project root: the root holds the READMEs,
`node_modules` and `.git`, and the terminal hashes and watches everything it loads. A Vite
starter's zip carries its ready `dist/` build, so it runs at once without Node.js; Node.js 20+ is
needed to edit it.

## For whoever changes the starters

[`starters.json`](starters.json) lists them. Per starter:

| Field | What it is |
|---|---|
| `key` | the starter's name: `^[a-z0-9][a-z0-9-]{0,31}$`; its zip is `starter-<key>.zip` |
| `title`, `description` | the tile in the terminal, `ru` and `en` |
| `path` | the starter's folder in this repository |
| `build` | `"vite"` — CI runs `npm ci`, `npm run typecheck`, `npm run build`; `null` — no build |
| `serve` | the subfolder the terminal links to the widget |
| `manifests` | every `widget.json` the terminal writes the ID into; `<serve>/widget.json` is required |
| `packageJson` | where to write the ID as the package name, or `null` |
| `edit` | the file the terminal suggests opening first |

What CI checks (`node scripts/starters.mjs check`):

- a starter's manifests agree on `id`, `version` and `permissions`;
- no manifest carries `name`, `icon` or `author` — those are set in Nest;
- the loaded manifest's `entry` is a relative path; a dev-server address (`http://localhost:…`) is
  allowed in `dev/widget.json` only;
- every copy of `colibri.js` and `colibri.d.ts` is byte-identical to [`sdk/`](../sdk/):
  `node scripts/sync-sdk-copies.mjs` rewrites them, `--check` checks.

And what no script can check:

- colours only through `var(--colibri-role-*)` with a fallback, so the widget follows the
  terminal's theme;
- no `eval`, `new Function` or `document.write`: Nest's review refuses such code;
- on-screen text in the terminal's language (`handshake().lang`, the `theme` event), ru and en;
- the trading starter sends an order **only** from the Confirm click: never on load, from a timer,
  from a stream handler, from a restored setting or on a key press. Price and size are never
  restored from `storage`.

### Releasing

Every release of this repository is a starters release: terminals read
`releases/latest/download/starters.json`. To ship a change, merge it and push a `starters-X.Y.Z`
tag. The `starters.yml` workflow builds and packs the starters, publishes the release as a draft
(a draft is not `latest` until every zip is up), marks it latest and downloads it back to check
every hash.

The terminal builds a zip's address itself — `releases/download/<release>/<asset>`, with `release`
taken from the same index — so an index and its zips can never come from two different releases.

### The index format only grows

The published `starters.json` carries `schemaVersion: 1`. Within version 1, fields are only added,
optional; a terminal skips fields it does not know. A breaking change publishes `starters.v2.json`
beside it, and `starters.json` keeps being published for terminals that read version 1. A terminal
that meets a newer `schemaVersion` than its own asks to be updated.
