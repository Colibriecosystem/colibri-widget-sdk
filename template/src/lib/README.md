# `src/lib/` — the vendored SDK

`colibri.js` and `colibri.d.ts` are copied in **verbatim** from `sdk/colibri-js/` by
`scripts/publish-widget-sdk.ps1`; they are deliberately not committed here.

A bundled widget has to ship the SDK — the terminal injects the raw `window.colibri` tunnel, not
this wrapper — so the published template carries the two files and imports them from
`./lib/colibri.js`. Keeping a second copy in this repository would give it a way to drift from the
canonical one, and the canonical one is pinned against the terminal's live route table by test.
One copy, copied at publish time, cannot drift.

Run the publish script (or copy the two files by hand) before `npm run build` here.
