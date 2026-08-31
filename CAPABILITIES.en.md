# The widget environment: what works, what doesn't, and how to pick an architecture

> Русская версия — [CAPABILITIES.md](CAPABILITIES.md).

This page is the boundary of the possible. Read it **before** designing a widget: half of all
"why doesn't this work for me" questions are not bugs but platform rules, and this page says
which rule and why.

## The environment: Chromium, and only Chromium

A widget is a web page in WebView2 (the Chromium engine, the same one behind Microsoft Edge,
updated with it). Both the good and the hard parts follow from that:

- **Write in anything that builds for the web.** Modern JS/TS with no legacy-browser
  transpilation, any framework, **WebAssembly without restrictions** — Rust, Go, C#, a Python
  core via Pyodide. The platform does not distinguish "plain JS" from WASM.
- **Nothing but web content executes.** A bundle is static files. The terminal will never start a
  process from it, load a native library, or invoke an interpreter. A `.py`, `.exe`, or `.dll`
  in a bundle is just bytes.
- **One shared environment, one origin each.** Your bundled widget lives at
  `https://<id>.widgets.colibri.internal`; another widget cannot even resolve your origin, and
  your storage and cookies are reachable by no one but you.
- **Windows 11 ships WebView2 preinstalled.** Clean Windows 10 / LTSC / Server may lack it: the
  terminal then shows a card with a runtime download link (~2 MB, no admin rights) — your code
  does nothing, but know that this first screen exists.
- **A hidden widget is never suspended.** Switching tabs does not stop your timers or sockets —
  a deliberate platform property. The flip side: saving resources is YOUR job — subscribe to the
  `visibility` event and slow your updates down while nobody is looking.

## Hard boundaries

These are not settings — they are construction. No manifest permission lifts them.

| Boundary | What exactly | Why |
| --- | --- | --- |
| Network is declared-only | A page request goes only to your own origin and the hosts in `egress`; everything else is refused. Declare EVERY host, exchange WebSocket hosts included | At install the user sees where the widget can send data. The list is a promise, and the terminal enforces it |
| `127.0.0.1` is unreachable | Loopback and IP literals cannot go into `egress`, and the page cannot reach them. That covers both the terminal's own Local API and any local program. This is a final decision, not a temporary limitation — see pattern 4 below | The Local API is the door for native programs with a different trust model; a widget doesn't need it — the `window.colibri` bridge does more, with no port and no token |
| No files, no processes | No filesystem, OS, or other-process access. Storage is `colibri.storage`, a 5 MB key-value store per widget | A widget must be exactly as safe as its consent claims — and a consent cannot honestly describe "access to the whole computer" |
| Nothing runs while the terminal is closed | A widget lives as long as the terminal does. There are no background services | A widget is part of the terminal, not a separate program |
| Rate and money limits | 300 bridge calls per minute per widget; `colibri.net.fetch` has its own budget; per-connection trading budgets (default $250 per order, 12 orders per minute — the user can lift them) | A bug in a loop must not cost the user money or CPU |
| Bundle caps | 2 000 files / 20 MB per file / 50 MB total | The bundle hash is verified at every start — the size has to stay verifiable |

And one boundary that works in your favor: **the Local API token and port never appear in page
code**. Widget identity is structural (the terminal knows which WebView is speaking), so there is
simply no secret in your code to leak.

## How to pick an architecture

Four patterns. Decide before the first line of code — moving between them costs more than
everything else.

### 1 · Everything in the page (bundled)

Data — your own exchange WebSockets + `colibri.net.fetch` (see the README's market-data section);
terminal things — the bridge; compute — JS or WASM. Both reference widgets in `examples/` are
built this way.

**Take this pattern by default.** It is the only one that gives the full set: the Nest catalog,
consent, revocation, a pinned content hash, theming, one-click install — and not a single
dependency the user installs separately.

### 2 · Hosted: a page from your server

`entry` is your https URL; the backend is your server, running whatever you like — Python
included. The honest price: identity is the origin, not a content hash (the amber `hosted`
badge), and user data flows through your server — the consent shows that. Fits SaaS tools that
already have a server.

### 3 · A native program + the Local API (no widget at all)

A local program in any language talks to the terminal over the Local API (discovery file
`%APPDATA%\Colibri\localapi.json`; Python has an official SDK —
[colibri-sdk](https://github.com/Colibriecosystem/colibri-sdk)). Opening coins, placing alerts,
reading accounts, trading under a grant — all of it is available this way, with no WebView at
all. The price: your UI is not inside the terminal, there is no Nest catalog, and the user
trusts your exe wholesale — the platform verifies and revokes nothing here.

### 4 · Widget page + a local backend — not supported. The decision is final

The combination — "UI in the terminal, compute in my local program" — was considered and
**rejected**. The reason is not that a local program "might be dangerous" in the abstract, but
what the platform can vouch for: a widget bundle is hashed, its rights are granted through
consent and revoked in one click — while a local exe can be neither hashed, nor revoked, nor
contained. A consent that says "this widget is safe" while the product is really "widget + exe"
would be a lie. So the boundary follows what the terminal executes itself: **bundled (JS/WASM)
or hosted — and nothing third**.

What this means in practice if your tool today is a page + a local backend:

- **Hosted — the path with no core rewrite.** Your server already serves both the page and the
  API from one origin — move it from `127.0.0.1` to your own domain, point `entry` at the URL,
  and everything works as it did: the page talks to its own origin (that's same-origin — no CORS,
  no `egress` entries needed), and the server opens the exchange WebSockets. The price: the
  server is now yours to run — infrastructure, accounts, and user data flowing through it (the
  consent shows that).
- **Bundled — full citizenship at the cost of a rewrite.** The core goes to WASM (Pyodide for
  Python) or JS; exchange connections open from the page (see the README on market data). It is
  real work, but only this path gives the catalog, the pinned hash, and independence from your
  server.
- **Staying a native program (pattern 3) remains a first-class path.** The Local API is not
  going anywhere; you simply live without a UI inside the terminal.

## Rules of a good widget

- **One transport module.** All `fetch`/`stream`/bridge calls in one file; tables, forms and
  charts never know where data comes from. This rule has already paid for itself twice in real
  migrations.
- **Theme via tokens.** Colors only through `--colibri-role-*` (see the README's styling
  section) — the widget follows the user's theme with zero code.
- **Subscribe, don't poll.** `colibri.stream.subscribe` instead of a `request` loop — polling
  eats the 300-calls/min budget instantly, a subscription spends none of it.
- **`handshake()` once at start**; check rights via `grantedScopes` and listen to the `grants`
  event — the user can revoke a permission live, and your UI must survive it.
- **Ask for the minimum.** Every consent line is a reason not to install your widget; the
  catalog policy explicitly names excess permissions as grounds for refusal
  ([policies/CONTENT.en.md](policies/CONTENT.en.md)).
