# `src/lib/` — the SDK, vendored

`colibri.js` and `colibri.d.ts` are byte-for-byte copies of this repository's `sdk/` files. They
are committed: a bundled widget has to ship the SDK — the terminal injects only the raw
`window.colibri` tunnel, not this wrapper — and a starter has to build straight from its zip.

CI keeps the copies honest: `node scripts/sync-sdk-copies.mjs --check` fails when one falls behind
`sdk/`, and `node scripts/sync-sdk-copies.mjs` rewrites them. Do not edit them here; change `sdk/`.
