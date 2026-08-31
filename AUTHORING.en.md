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

Apply once, and any user can see your widget in the catalog and install it in one click. It all
happens inside the terminal: **Nest → Add widget → "Listed"**.

1. **Your author ID.** There is no sign-in and no password. Publish your first widget and Nest
   issues you an ID; the terminal keeps it and sends it with everything you publish afterwards.

   **Copy it and store it somewhere safe.** It is how the registry knows your widgets are yours —
   it is what stops anyone else updating them, and equally what lets anyone holding it publish as
   you. It is issued once and cannot be issued again, so if you lose it you cannot update your own
   widgets; write to us and we will sort it out by hand. Moving to a new machine, paste it into the
   same field.

   **Name** and **e-mail** are optional. The name is what the catalog shows; leave it blank and the
   listing simply carries none. The e-mail is only so we can reach you about your widgets — it is
   never shown to anyone.
2. **The archive** — the same Pack-for-Nest button. Its contract (the hash reproduces from the
   extracted content) is precisely what the registry checks.
3. **The card** — what you fill in on the form. Two axes, deliberately distinct:
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
surfaces, permissions, network hosts — derives from the archive's own manifest, **using the same
code the desktop verifies with**. The form asks only for decoration (descriptions, category, tags),
which is why it has no security field at all.

After the upload the checks run server-side and the window shows them one by one. A refusal names
the specific check — your diagnostic, not "submission rejected".

Before your first submission, read [policies/CONTENT.en.md](policies/CONTENT.en.md): what may be
published, and why asking for a spare permission is a bad idea. What happens if a widget is taken
down: [policies/TAKEDOWN.en.md](policies/TAKEDOWN.en.md).

---

## Where next

- [CAPABILITIES.en.md](CAPABILITIES.en.md) — the widget environment: what works, what doesn't,
  and how to pick an architecture (read before designing).
- [README.en.md](README.en.md) — the `window.colibri` SDK: routes, channels, `colibri.net.fetch`.
- [`template/`](template/) — the starter project.
- [`examples/`](examples/) — the terminal's two reference widgets with committed `dist/` builds.
