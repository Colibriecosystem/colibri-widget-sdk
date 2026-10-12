# The `widget.json` manifest

> Русская версия — [manifest.md](manifest.md).

`widget.json` sits at the root of the widget's folder and of its archive, and tells the terminal and
Nest what the widget is: which page to open, where it lives, what it may do and where it may go on the
network. The terminal and Nest read the manifest by the same rules. A refusal names a stable code; each
field below lists its codes, linked to their explanation in [CHECKS.en.md](../../CHECKS.en.md).

General rules:

- The file is a JSON object at the root, not in a subfolder
  ([`manifest.missing`](../../CHECKS.en.md#manifestmissing),
  [`manifest.invalid-json`](../../CHECKS.en.md#manifestinvalid-json)). A manifest is a description, not
  data: one that is too long is refused ([`manifest.too-large`](../../CHECKS.en.md#manifesttoo-large)).
- Field names are spelled exactly as here, case included. The terminal skips a field it does not know,
  so a typo in an optional field's name is not an error but a field silently left unset.
- A value of the wrong type — a string for a number, a string for a list — is
  [`manifest.invalid-json`](../../CHECKS.en.md#manifestinvalid-json).
- The `permissions`, `egress` and `browserPermissions` lists hold up to 32 entries; an empty entry or
  one longer than 256 characters is refused.
- There is no name, icon or author in the manifest: they live on the widget in Nest — see
  [legacy fields](#legacy-fields).

## <a id="example"></a>Example

A manifest with every field that means something today:

```json
{
  "id": "funding-radar",
  "version": "1.2.0",
  "entry": "index.html",
  "surfaces": ["slot", "window"],
  "permissions": ["marketData", "notifications", "storage"],
  "egress": ["fapi.binance.com", "fstream.binance.com", "*.okx.com"],
  "minApiVersion": 1,
  "minColibriVersion": "1.4.0",
  "singleInstance": false,
  "windowScope": "app",
  "browserPermissions": ["clipboard-read"]
}
```

Only `id`, `version`, `entry` and `surfaces` are required; the rest have defaults.

## <a id="fields"></a>Fields

### <a id="manifest-id"></a>`id`

**String, required.** Codes: [`manifest.missing-id`](../../CHECKS.en.md#manifestmissing-id),
[`manifest.invalid-id`](../../CHECKS.en.md#manifestinvalid-id),
[`manifest.id-mismatch`](../../CHECKS.en.md#manifestid-mismatch),
[`ownership.taken`](../../CHECKS.en.md#ownershiptaken),
[`ownership.retired`](../../CHECKS.en.md#ownershipretired).

The widget's ID: 1 to 40 characters — lowercase Latin letters, digits and hyphens, a hyphen neither
first nor last. It is at once the widget's origin (`https://<id>.widgets.colibri.internal`) and its
install folder's name, which is why the rule is this strict. Nest issues the ID when you create the
widget, and the terminal writes it into `widget.json` by itself when you link a folder to the widget —
see [the widget ID](../publishing.en.md#widget-id). The ID does not change between versions: another ID
is another widget.

### <a id="manifest-version"></a>`version`

**String, required.** Codes: [`manifest.missing-version`](../../CHECKS.en.md#manifestmissing-version),
[`manifest.invalid-version`](../../CHECKS.en.md#manifestinvalid-version),
[`manifest.version-prerelease`](../../CHECKS.en.md#manifestversion-prerelease),
[`manifest.version-not-plain`](../../CHECKS.en.md#manifestversion-not-plain),
[`ownership.version-not-after`](../../CHECKS.en.md#ownershipversion-not-after).

The widget's version number — three numbers `X.Y.Z`: `1.2.0`. To be published it has no suffix
(`1.2.3-beta.1` is out), no leading zeros (`01.2.0` is out) and no more than nine digits in a part. An
unpacked folder loads with a suffix too, but such a version cannot be released. Numbers only grow and
never repeat; which part to raise is in [the version number](../publishing.en.md#release-version).

### <a id="manifest-entry"></a>`entry`

**String, required.** Codes: [`manifest.missing-entry`](../../CHECKS.en.md#manifestmissing-entry),
[`manifest.invalid-entry`](../../CHECKS.en.md#manifestinvalid-entry),
[`consistency.mismatch`](../../CHECKS.en.md#consistencymismatch),
[`origin.unreachable`](../../CHECKS.en.md#originunreachable).

The page the widget starts from. One of two forms:

- **A path inside the folder** — `index.html`, `app/index.html`. Relative only: no leading `/`, no `.`
  or `..`, no empty parts like `a//b`; a backslash reads as a forward slash. The file must be in the
  archive and be `.html`.
- **An `https://` address** — a hosted widget: the page loads from your site, and its origin becomes
  the widget's identity. The address's host must be listed in [`egress`](#manifest-egress), and Nest
  checks that the address answers. The hosted-or-bundled fork is in
  [publishing](../publishing.en.md#hosted).

Any other scheme — `http://`, `file://` — is refused. There is one exception: a dev server address in an
unpacked folder, see [below](#dev-server-entry).

### <a id="manifest-surfaces"></a>`surfaces`

**List, required, not empty.** Codes:
[`manifest.missing-surfaces`](../../CHECKS.en.md#manifestmissing-surfaces),
[`manifest.invalid-surface`](../../CHECKS.en.md#manifestinvalid-surface).

Where the widget may live: `"slot"` — a slot in a tab; `"window"` — a standalone window. The values are
lowercase; a repeat does not count. Only a widget with `"window"` opens as a standalone window and pins
as a bookmark in the bottom strip; a widget with only `"slot"` lives in panels alone. The terminal does
not open the widget on a surface missing from the list. A widget is moved between surfaces without a
restart — see the [`surface`](bridge.en.md#event-surface) event.

### <a id="manifest-permissions"></a>`permissions`

**List, optional, empty by default.** Codes:
[`manifest.too-many-permissions`](../../CHECKS.en.md#manifesttoo-many-permissions),
[`manifest.invalid-permission`](../../CHECKS.en.md#manifestinvalid-permission),
[`review.excess-permissions`](../../CHECKS.en.md#reviewexcess-permissions),
[`embed.remote-shell`](../../CHECKS.en.md#embedremote-shell).

The API scopes the widget asks for: `marketData`, `account:read`, `trading`, `panels`,
`notifications`, `signalLevels`, `storage`. What each opens and how the user grants them is in
[permissions](README.en.md#permissions). An unknown name fails the manifest rather than being skipped.
Declare only what your code uses: each scope is a line in the consent dialog, a new one in a later
version asks the user again, and an unneeded one gives a moderator a reason to decline the version. A
widget that is only a wrapper around someone else's page cannot ask for `trading` or `account:read`.

### <a id="manifest-egress"></a>`egress`

**List, optional, empty by default.** Codes:
[`manifest.too-many-egress`](../../CHECKS.en.md#manifesttoo-many-egress),
[`manifest.invalid-egress`](../../CHECKS.en.md#manifestinvalid-egress),
[`egress.hosted-own-origin`](../../CHECKS.en.md#egresshosted-own-origin),
[`egress-code.undeclared-host`](../../CHECKS.en.md#egress-codeundeclared-host),
[`egress-ws.undeclared-host`](../../CHECKS.en.md#egress-wsundeclared-host),
[`embed.remote-frame`](../../CHECKS.en.md#embedremote-frame).

The hosts the widget may reach on the network. Without them, the page reaches only its own origin. An
entry takes one of three forms:

| Entry | What it covers |
| --- | --- |
| `api.example.com` | this host on any port |
| `api.example.com:8443` | this host on port 8443 only |
| `*.example.com` | any subdomain of `example.com` at any depth — but not `example.com` itself |

No scheme and no path: `https` and `wss` are implied, and `http` and `ws` are not allowed at all. Case
does not matter. Refused: `localhost` and anything under `.localhost`, IP addresses, `*.com` and other
wildcards over a top-level domain, a wildcard anywhere but the start, a port outside 1–65535. If you need
both `example.com` and its subdomains, write both entries. Over 32 hosts — merge subdomains under one
wildcard.

The list governs everything at once:

- the page's requests — `fetch`, XHR, images, scripts, frames — to a host not on the list are refused;
- `new WebSocket(...)` to a host not on the list throws a `SecurityError` at construction: the document
  is served with a `Content-Security-Policy: connect-src` built from this list;
- `net.fetch` to a host not on the list answers `egress_denied`.

The user sees the list in the consent dialog; a new host in a later version asks them again. If the
widget also asks for `account:read`, the user separately confirms that account data may leave for these
hosts. A hosted widget must list its `entry`'s host here.

### <a id="manifest-min-api-version"></a>`minApiVersion`

**Integer, optional, 1 by default.** Code:
[`manifest.invalid-min-api-version`](../../CHECKS.en.md#manifestinvalid-min-api-version).

The oldest version of the `window.colibri` contract the widget works with; at least 1. It is compared
with the terminal's `handshake().apiVersion` — currently 1. A terminal with an older contract does not
start the widget, rather than letting it fail halfway through its first call. The contract grows only
with breaking API changes, so if your widget needs a feature from a newer Colibri release, use
[`minColibriVersion`](#manifest-min-colibri-version). More in [versions](README.en.md#versions).

### <a id="manifest-min-colibri-version"></a>`minColibriVersion`

**String, optional; absent means any terminal.** Code:
[`manifest.invalid-min-colibri-version`](../../CHECKS.en.md#manifestinvalid-min-colibri-version).

The oldest terminal version the widget works on — three numbers with no suffix: `"1.4.0"`. Terminals
newer than 1.3.1 do not install, offer as an update, or start a version that needs a newer Colibri: the
user sees "Requires Colibri 1.4.0 or newer", and the version they already have keeps working. Terminals
1.3.1 and older do not read the field. A pre-release terminal build `1.4.0-beta.2` counts as `1.4.0`.

### <a id="manifest-single-instance"></a>`singleInstance`

**`true` or `false`, optional, `false` by default.**

`true` means the widget never has more than one running instance: when it is opened again, in another
slot or in a window, the terminal hands back the running instance instead of starting a second one. Set
it when two instances make no sense. By default every slot and every window is an instance of its own,
with its own `instanceId` and its own `storage`.

### <a id="manifest-window-scope"></a>`windowScope`

**`"app"` or `"tab"`, optional, `"app"` by default.** Code:
[`manifest.invalid-window-scope`](../../CHECKS.en.md#manifestinvalid-window-scope).

How the widget's window behaves when the user switches tabs; a widget without `"window"` in
[`surfaces`](#manifest-surfaces) has no use for it. `"app"` — the window is a standalone tool and does
not hide on a tab switch. `"tab"` — the window belongs to its tab and hides when the user leaves it,
unless the window is pinned — like a chart window. The value is lowercase; anything else is refused.

### <a id="manifest-browser-permissions"></a>`browserPermissions`

**List, optional, empty by default.** Codes:
[`manifest.invalid-browser-permission`](../../CHECKS.en.md#manifestinvalid-browser-permission),
[`manifest.forbidden-browser-permission`](../../CHECKS.en.md#manifestforbidden-browser-permission).

What the page may ask the browser for: `microphone`, `camera`, `clipboard-read`, `file-read-write`,
`autoplay`. Names a widget never gets — `geolocation`, `notifications`, `sensors`,
`automatic-downloads`, `local-fonts`, `midi-sysex`, `window-management`, `persistent-storage` — fail the
manifest. It is a separate list: terminal rights such as `storage` or `notifications` go in
[`permissions`](#manifest-permissions). The user consents to each in the install dialog and can switch
any of them off. A terminal released before this field does not read it and refuses every request. The
full rules are in [CAPABILITIES.en.md](../../CAPABILITIES.en.md#browser-permissions).

## <a id="dev-server-entry"></a>`entry` on a dev server

For Vite's hot reload, `entry` may point at your dev server: `http://localhost:5173`. This allowance
is for an unpacked folder only — the one the terminal runs the widget from, in place, while you write it
(see [your own folder](../getting-started.en.md#own-folder)):

- only the literal `localhost` and `127.0.0.1` will do; other loopback addresses, like `127.0.0.2` or
  `[::1]`, will not;
- such a manifest is never released: an ordinary install, packing and Nest all refuse it
  ([`manifest.invalid-entry`](../../CHECKS.en.md#manifestinvalid-entry)), because there is nothing to
  distribute;
- a page from the dev server gets the same `connect-src`, with your dev origin spelled out as `'self'`
  including its port. Vite's HMR socket on the `entry`'s own port just works, while one moved to another
  port (`server.hmr.port`) is refused — keep it on the `entry`'s port;
- loopback still cannot be written into `egress`.

The Vite starters keep two manifests: `dev/widget.json` with the dev server address for working, and
`public/widget.json` with `index.html`, which the build puts into `dist/`.

```json
{
  "id": "my-widget",
  "version": "1.0.0",
  "entry": "http://localhost:5173",
  "surfaces": ["slot", "window"],
  "permissions": ["marketData", "storage"],
  "minApiVersion": 1
}
```

## <a id="legacy-fields"></a>Legacy fields

A widget's name, icon and author now live on the widget itself, in Nest: you set the name and the icon
in the widget's listing on the Author tab — see [the listing](../publishing.en.md#listing) — and the
byline is the name in your author profile. A manifest with these fields still works: Nest does not
refuse it, it marks it with the informational
[`manifest.legacy-fields`](../../CHECKS.en.md#manifestlegacy-fields), which does not stop automatic
approval. The terminal's "Remove from widget.json" button takes them out for you. The exception is
Colibri 1.3.2 or older: without `name` those releases neither load the folder nor install a version, so
while you or your users are on one, keep `name`.

### <a id="manifest-name"></a>`name`

**String up to 64 characters, legacy.** Codes:
[`manifest.invalid-name`](../../CHECKS.en.md#manifestinvalid-name),
[`manifest.missing-name`](../../CHECKS.en.md#manifestmissing-name).

Nest takes it once — as a new widget's name, when a version from an older Colibri is uploaded with an ID
Nest does not know yet. Otherwise the field is not read.

### <a id="manifest-icon"></a>`icon`

**Path up to 256 characters, legacy.** Codes:
[`manifest.invalid-icon`](../../CHECKS.en.md#manifestinvalid-icon),
[`consistency.mismatch`](../../CHECKS.en.md#consistencymismatch).

A path to an image in the archive. Nest takes it once — as the icon of a new widget, or of a
never-approved draft with no icon; from Colibri 1.3.0 or older, on every upload. Set the icon in Nest:
a PNG (JPEG and WEBP work too, SVG does not) up to 512 KB; a square 128×128 on a transparent background
is best.

### <a id="manifest-author"></a>`author`

**String up to 64 characters, legacy.** Code:
[`manifest.invalid-author`](../../CHECKS.en.md#manifestinvalid-author).

Never read: the byline is the name in your author profile.
