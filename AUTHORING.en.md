# The widget author's path

> Русская версия — [AUTHORING.md](AUTHORING.md).

An author has two places in the terminal:

- **Nest → Author** — everything about your widgets: your profile and author ID, a page per
  widget, the link to your project folder (development with hot reload), releasing versions,
  review, catalog or link.
- **Nest → My widgets → Add a local widget…** — an install on this machine only: a zip, a link to a
  .zip, a link to a by-link-only widget, or a running web app by its URL.

| Mode | Where | Integrity | DevTools |
| --- | --- | --- | --- |
| Development | Author → the widget → Code | hash re-pinned on every reload | always |
| Local install | My widgets → Add a local widget… | hash pinned at install | per setting |
| Publishing | Author → the widget → Release a version | hash asserted by the registry | — |

> Earlier terminal versions kept all of this in one "Add widget…" dialog — with Development and
> Listed cards and a "Pack for Nest" button on the widget's row. Current versions have none of
> them: development and publishing moved to the Author tab.

---

## First, the fork: hosted or bundled

If you **already have a working web app on your own https domain**, take hosted. `entry` points at
your URL, the folder is a single `widget.json`, there is nothing to build and nothing to pack, and
you ship updates from your own server without republishing the widget. Authors who already have a
site still tend to build a bundle anyway — that is extra work which, in their case, buys almost
nothing.

| | Hosted (`entry` is your https URL) | Bundled (`entry` is a file in the folder) |
| --- | --- | --- |
| What it takes | a working site | a project build |
| Updates | you ship them on your server | a new version |
| Nest catalog, consent, revocation, theming, one-click install | yes | yes |
| Catalog badge | amber `hosted` | green `bundled · hash ✓` |
| Works without your server | no | yes |
| Moderation | always by hand: hosted never auto-approves | a trusted publisher's updates can auto-approve |

**Do not wrap your site in a bundle.** A bundle whose entire entry document is an `<iframe>` of
your site is hosted wearing bundled clothes: the registry detects it with its own check (`embed`),
the card still gets the amber badge naming the embedded site, and if such a widget asks for
`trading` or `account:read` the submission is **refused automatically**. The green badge is earned
only by code that actually ships in the archive — the hash covers what arrived in the zip, not what
your server will serve tomorrow.

The architectural side of the choice is in [CAPABILITIES.en.md](CAPABILITIES.en.md), "How to pick
an architecture".

---

## Become an author

**Nest → Author → Become an author.** There is no sign-in and no password. Enter a **display
name** (users see it) and an **email** (only Colibri sees it — so we can reach you about your
widgets); the YouTube, Telegram and source-code links are optional and can change later. Hit
**Create author ID** — Nest issues your ID, and the terminal shows it on a card until you press
**I saved it**.

**Copy the ID and store it somewhere safe.** It is how the registry knows your widgets are yours —
it is what stops anyone else updating them, and equally what lets anyone holding it act as you. It
is issued once and cannot be issued again, and there is no recovery yet: if you lose it you cannot
update your own widgets — write to us and we will sort it out by hand. On another machine, paste
it under **I already have an author ID**.

## A new widget

**New widget** asks for a name and an **ID** — the same as the `id` field in your `widget.json`: a
widget's ID in Nest is your own. **From a folder…** takes the ID and the name from the chosen
folder's `widget.json` and links the folder to the widget as soon as it is created. The ID must be
free — Nest refuses a taken one. The category and description can be filled in now or later —
before the first version. The widget's page opens: **Overview**, with
the one next step and what is still missing before the first version, and the **Versions**,
**Listing**, **Code**, **Access** and **Stats** sections.

---

## Development: the project folder

**Code → Choose a folder….** The folder must carry this widget's ID in its `widget.json`: the
terminal serves it **in place** — nothing is copied, and it never changes the file. If the folder
carries another ID, the terminal says which one it needs. A draft that has no version yet can
instead take the folder's ID — the old one is then free again. A folder that
already belongs to another of your widgets is refused.

DevTools are always offered, logs are full, and the **Hot reload** toggle rebuilds the widget about
half a second after every save (a burst of saves collapses into one reload). **Reload** does the
same by hand. Everything runs inside the terminal — no browser needed if you so choose: DevTools
open straight from the widget's menu.

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
DNS label (`a–z`, `0–9`, hyphens, up to 40 characters). It is the widget's ID in Nest: choose it
once — it does not change after the first version. `entry` is a path inside the folder. A full starter project (TS + React, no
framework lock-in) lives in [`template/`](template/).

The optional `icon` field is an image path **inside the bundle** (a URL is not accepted): the
terminal renders it everywhere the widget is visible — the catalog card and listing, the
My-widgets list, the Notifications window Widgets tab, the bottom-strip bookmark, the panel and
window headers, the 🧩 menu. Without one, the 🧩 glyph shows everywhere. The catalog icon can also
be set on its own, in the Listing section.

- **Format** — PNG (JPEG and WEBP are read too); **SVG is not supported**.
- **File size** — up to 512 KB.
- **Image size** — 128×128, square, transparent background: the largest the icon is ever drawn is
  44×44 in the listing header, and 22–26 px in lists.
- **Failures are silent.** A wrong path, a file over the cap, a format that cannot be decoded —
  each simply leaves the 🧩 glyph, with no message anywhere. If the icon "did not show up", check
  the path and the file size first.

And on `surfaces`: only a widget that declares `"window"` can be opened as a standalone window and
pinned to the bottom bookmark strip — a slot-only widget lives in panels exclusively.

One mode exists only for a linked folder: `entry` may point at a dev server
(`http://localhost:5173/`) — that is how Vite HMR works. An ordinary install refuses such a
manifest; the allowance is deliberate and scoped to development. Keep the HMR socket on the entry's
own port: the page's `connect-src` names your dev origin with that port, and nothing else on
loopback.

Every reload in this mode **re-pins** the content hash: you change the code, the terminal accepts
the new version as yours. That is the difference from Prod mode, where a changed byte is a reason
to refuse to start.

---

## The listing

The **Listing** section is how the widget looks in the catalog: name, icon, category, tags,
descriptions in Russian and English. Beside it, the catalog row exactly as users will see it,
updated as you type. Edits are saved at once, with no new version; only a new name or a new icon
for a widget already in the catalog waits for a moderator.

Two axes, deliberately distinct: a **category** is a key from our curated list, one per widget;
**tags** are your own, capability-focused, any number, displayed verbatim.

A listing cannot overstate or understate permissions: everything security-relevant — name,
version, surfaces, permissions, network hosts — derives from the archive's own manifest, **using
the same code the desktop verifies with**. That is why the listing has no security field at all.

---

## Releasing a version

**Release a version** (for a new widget, "Release the first version") opens a four-step wizard:

1. **Number.** The wizard offers a number past the highest the widget ever carried — a fix, new
   features, or breaking changes — or your own, if it comes after the highest. A used number is
   never reused, even if that version was declined or you withdrew it. The number is written into
   `widget.json` when the archive is packed, and put back if you cancel.
2. **What's new.** In Russian and English, up to 1000 characters each. Required in at least one
   language for an update — users see it before they update. Optional for the first version. If a
   new widget still has no category or description, the wizard stops here and sends you to the
   Listing: the first version would not pass review without them.
3. **Archive.** The terminal packs the linked folder so the hash reproduces by **extracting and
   re-hashing the content** (exactly how the registry checks it), and shows the size, the hash and
   **what changes for users**: added and dropped permissions, network addresses, and the places the
   widget opens in. A new permission or a new host means users are asked again when they update,
   and a moderator reviews such a version. When only the code changes, it says so.
4. **Send — and where to offer it.** **In the catalog** or **By link only**, on every release. A
   first version defaults to the catalog: a moderator reviews it together with the listing, and
   once approved the widget appears in the catalog for everyone. An update starts where the widget
   is now (marked "now"): moving into the catalog is a request the moderator decides together with
   that version; leaving it happens as soon as the version passes the automatic checks, no
   moderator needed, and installed copies keep working. **Send for review** — and the wizard closes
   onto Versions.

### After sending

The **Versions** section is the history of every version: its state, when it was sent and decided,
its "What's new", and what it changed for users. The checks run server-side; a refusal names the
specific check and its code, and the terminal says what to fix, with a link to the rule — your
diagnostic, not "submission rejected". Every code and what to do about it:
[CHECKS.en.md](CHECKS.en.md). A version waiting for a person shows when a moderator usually
answers; if one declined it — the reason, the note and the conversation about it. Fixed the code?
**Send a new version…** opens the same wizard.

- **Edit "What's new"** — the text changes with no new version and no review.
- **Withdraw** — a version still waiting for review can be pulled from it. Its number stays used,
  and the next version gets a higher one.

The **Access** section — the **install link** (it appears after the first upload and works once the
first version is approved; anyone with it can install the widget, in the catalog or not), the
current visibility, **Withdraw** / **Restore**, and **Delete** — the last only for a draft that was
never approved.

Before your first version, read [policies/CONTENT.en.md](policies/CONTENT.en.md): what may be
published, and why asking for a spare permission is a bad idea. What happens if a widget is taken
down: [policies/TAKEDOWN.en.md](policies/TAKEDOWN.en.md).

---

## Local install

Everything a "real" catalog widget has — the content hash pinned at install, permissions granted
through the consent dialog, the enable switch, one-click grant revocation — but available only on
this machine. All from one dialog: **Nest → My widgets → Add a local widget…**.

### From a zip archive

**Install from zip…** installs an archive with `widget.json` at its root: zip-slip defence, caps on
the decompressed size (2000 files / 20 MB per file / 50 MB total), the staging folder always
deleted. The hash is computed over the extracted content, so an archive made with any zip tool
yields the same hash.

### From a .zip URL

Paste an https link ending in `.zip` into the "From the web" box and hit **Continue** — the
terminal downloads it over its own route chain (direct first, then your proxies; a 64 MB cap on
received bytes) and runs it through the same zip path: same consent, same hash from the extracted
content.

### From a by-link-only widget's link

The author of a widget that is not in the catalog hands out an install link. Paste it into the
same box — the terminal installs the widget from Nest.

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

**A hosted widget's logo, and publishing one.** The URL form mints a one-file `widget.json` and has
no `icon` field: such a widget keeps the 🧩 glyph everywhere and does not reach the catalog. If your
hosted widget wants its own logo or a place in the catalog, build the folder by hand — it is two
files:

```
my-widget/
├─ widget.json   ← entry: "https://your-domain/app/"
└─ icon.png
```

create a widget on the Author tab, link this folder to it in the Code section, and release a
version. Only the manifest and the icon travel in the archive — the code stays on your server, and
the hash covers exactly those two files.

---

## Where next

- [CAPABILITIES.en.md](CAPABILITIES.en.md) — the widget environment: what works, what doesn't,
  and how to pick an architecture (read before designing).
- [README.en.md](README.en.md) — the `window.colibri` SDK: routes, channels, `colibri.net.fetch`.
- [`template/`](template/) — the starter project.
- [`examples/`](examples/) — the terminal's two reference widgets with committed `dist/` builds.
