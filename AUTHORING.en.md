# The widget author's path: three stages

> Русская версия — [AUTHORING.md](AUTHORING.md).

A widget moves through three stages — from a folder on your machine to the community catalog. All
three live in one place: **Nest → My widgets → Add widget…**. The dialog shows the stages as three
cards; this page is the long version of each.

| Stage | What it is | Integrity | DevTools |
| --- | --- | --- | --- |
| 1 · Development | your folder, served in place | hash re-pinned on every load | always |
| 2 · Local install | a full Prod install, this machine only | hash pinned at install | per setting |
| 3 · Listed | the community catalog (next beta) | hash asserted by the registry | — |

---

## Stage 1 · Development

**Load unpacked…** serves your folder **in place** — nothing is copied. DevTools are always
offered, logs are full, and the **Hot reload** toggle rebuilds the widget about half a
second after every save (a burst of saves collapses into one reload). **Reload** does the same by
hand. Everything runs inside the terminal — no browser needed if you so choose: DevTools open
straight from the widget's menu.

The minimal folder is two files:

```
my-widget/
├─ widget.json
└─ index.html
```

```json
{
  "id": "my-widget",
  "name": "My Widget",
  "version": "0.1.0",
  "entry": "index.html",
  "surfaces": ["slot", "window"],
  "permissions": ["storage"]
}
```

`id` doubles as the install folder name and the virtual-host label, so it is strictly a lowercase
DNS label (`a–z`, `0–9`, hyphens). `entry` is a path inside the folder. A full starter project
(TS + React, no framework lock-in) lives in [`template/`](template/).

The optional `icon` field is an image path inside the bundle (PNG, up to 512 KB): the terminal
renders it everywhere the widget is visible — the catalog card and listing, the My-widgets list,
the Notifications window Widgets tab, the bottom-strip bookmark, the panel and window headers,
the 🧩 menu. Without one, the 🧩 glyph shows everywhere. And on `surfaces`: only a widget that
declares `"window"` can be opened as a standalone window and pinned to the bottom bookmark strip —
a slot-only widget lives in panels exclusively.

One mode exists only here: `entry` may point at a dev server (`http://localhost:5173/`) — that is
how Vite HMR works. An ordinary install refuses such a manifest; the allowance is deliberate and
scoped to the unpacked mode.

Every reload in this mode **re-pins** the content hash: you change the code, the terminal accepts
the new version as yours. That is the difference from Prod mode, where a changed byte is a reason
to refuse to start.

---

## Stage 2 · Local install

Everything a "real" catalog widget has — the content hash pinned at install, permissions granted
through the consent dialog, the enable switch, one-click grant revocation — but available only on
this machine. Three ways in, all from the same dialog:

### From a zip archive

Your unpacked widget's row carries **Pack for Nest** — it builds the archive so the reported hash
is reproducible by **extracting and re-hashing the content** (exactly how the registry's CI will
verify it). Install the produced file with **Install from zip…** — zip-slip defence, caps on the
decompressed size (2000 files / 20 MB per file / 50 MB total), the staging folder always deleted.

### From a .zip URL

Paste an https link ending in `.zip` into the "From the web" box and hit **Continue** — the
terminal downloads it over its own route chain (direct first, then your proxies; a 64 MB cap on
received bytes) and runs it through the same zip path: same consent, same hash from the extracted
content.

### A running web app — just a URL, no folder

If the link does not end in `.zip`, the dialog expands a form: **Name**, **ID** (auto-derived from
the name, editable), **Version**, **Surfaces** (slot / window), **Permissions** (the same seven
the user sees in the consent dialog), and **Extra network hosts**. The link's own host always
joins `egress` — no need to type it.

The terminal mints the one-file `widget.json` itself and installs it as a hosted widget. For
example, the form

- URL: `https://screener.example.com/app/`
- Name: `My Screener` · Version: `1.0.0`
- Permissions: notifications, its own storage
- Extra hosts: `api.example.com`

becomes exactly this manifest:

```json
{
  "id": "my-screener",
  "name": "My Screener",
  "version": "1.0.0",
  "entry": "https://screener.example.com/app/",
  "surfaces": ["slot", "window"],
  "permissions": ["notifications", "storage"],
  "egress": ["screener.example.com", "api.example.com"]
}
```

The honest difference of hosted mode: identity here is the **origin, not a content hash**.
Whatever that URL serves tomorrow is what runs — which is why the card wears the amber `hosted`
chip instead of the green `bundled · hash ✓`.

---

## Stage 3 · Listed

Coming with the community registry (next beta): apply once, and any user can see your widget in
the catalog and install it in one click.

You can prepare today:

1. **The archive** — the same Pack-for-Nest button: its contract (the hash reproduces from the
   extracted content) is precisely what the registry's CI will check.
2. **The card** — an editorial row in `catalog.json`. Two axes, deliberately distinct:
   a **category** is a key from our curated list, one per widget, picked at submission; **tags**
   are your own, capability-focused, any number, displayed verbatim.

```json
{
  "id": "my-screener",
  "category": "analytics",
  "tags": ["screener", "funding"],
  "descriptionEn": "Cross-venue screener with funding extremes.",
  "descriptionRu": "Скринер по биржам с экстремумами фандинга."
}
```

A card cannot overstate or understate permissions: everything security-relevant — name, version,
surfaces, permissions, network hosts — derives from the archive's own manifest; the catalog row
only decorates (descriptions, category, tags).

---

## Where next

- [README.en.md](README.en.md) — the `window.colibri` SDK: routes, channels, `colibri.net.fetch`.
- [`template/`](template/) — the starter project.
- [`examples/`](examples/) — the terminal's two reference widgets with committed `dist/` builds.
