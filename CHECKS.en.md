# Nest checks: what a refusal means and how to fix it

Every Nest refusal names itself with a stable code. The terminal turns the code into a title, a hint
and a link here, to the rule with that code. For each code this page says what it means, why it
works that way, and what to do.

> Русская версия: [CHECKS.md](CHECKS.md)

How to read a result:

- **Refused by the checks** — the archive failed an automated check. The version was not stored, so
  you can send the same version number again once it is fixed.
- **Warning** — a check found something a person should look at. It does not stop the submission,
  but there is no automatic approval: a moderator reviews the version. The exception is
  [`manifest.legacy-fields`](#manifestlegacy-fields): it is for your information only and does not
  stop automatic approval.
- **Declined by a moderator** — the version was stored and declined after a person reviewed it. You
  can answer in that version's conversation; send the fixed code as the next version (the number
  must be higher).

The terminal fixes nothing for you: the hint says what to change in your code or in `widget.json`,
and "Send a new version" packs and sends what is already in the folder.

---

## Size and archive

### `size.too-large`

The upload is over 64 MB. Leave out what the widget does not need: sources, source maps (`.map`),
test data. The archive holds the built widget only.

### `archive.zip-unreadable`

The file does not open as a zip, or it is damaged. Pack it again with "Pack for Nest" — it builds the
archive exactly the way Nest checks it.

### `archive.unsafe-entry-path`

An entry path leaves the archive's root (`..`, an absolute path, a drive letter). Such an archive is
refused whole. Pack the widget folder again, with nothing pointing outside it.

### `archive.too-many-files`

More than 2000 files. Usually `node_modules` got in — pack the build folder only.

### `archive.file-too-large`

One file is over 20 MB once extracted. Split it or leave it out of the build.

### `archive.bundle-too-large`

The content is over 50 MB once extracted. Leave out what the widget does not need at run time.

### `archive.io-error`

Nest could not read the archive. Send it again; if it repeats, write to us.

## The `widget.json` manifest

### `manifest.missing`

There is no `widget.json` at the archive's root. It must sit at the root, not in a subfolder.

### `manifest.invalid-json`

`widget.json` is not valid JSON. Check the commas and quotes.

### `manifest.too-large`

`widget.json` is over 64,000 characters. The manifest describes the widget; it holds no data.

### `manifest.missing-id`

There is no `id`. The terminal writes the id Nest issued when you link the folder to the widget.

### `manifest.invalid-id`

`id` does not fit: lowercase Latin letters, digits and hyphens, at most 40 characters, not starting
or ending with a hyphen.

### `manifest.id-mismatch`

The archive names a different widget than the one the version was sent to. Nest takes a version
only into the widget whose ID is in `widget.json`. Link the folder to the right widget again — the
terminal writes its ID for you — and send it again.

### `manifest.missing-name`

The upload names no widget (that is how an old Colibri sends a version), Nest does not know the id
in `widget.json` yet, and the manifest has no `name` — the new widget has nothing to be called.
Create the widget in Nest first (the Author tab), then release a version into it. In every other
case `name` is not needed: the name lives on the widget in Nest.

### `manifest.invalid-name`

`name` is there but empty or over 64 characters. The field is checked only when it is present.
Better remove it: the name is set on the widget in Nest (see `manifest.legacy-fields`). On Colibri
1.3.2 or older keep `name` (Nest ignores it) and just fix it.

### `manifest.missing-version`

There is no `version`.

### `manifest.invalid-version`

`version` is not three numbers like `1.2.3`, or it is over 32 characters.

### `manifest.version-prerelease`

The number has a suffix, such as `1.2.3-beta.1`. Nest has no pre-release channel: every approved
version reaches every user, so a suffix means nothing here. Drop it and send a plain `1.2.3`. The
rules for numbers are in the [README](README.en.md#a-widgets-version-number-and-compatibility).

### `manifest.version-not-plain`

The number is not three plain numbers: it has a leading zero (`01.2.0`) or a part over nine digits.
Write it like `1.2.3`.

### `manifest.invalid-author`

`author` is there and over 64 characters. Nest does not read this field: the byline is the owner's
profile name. Remove `author` from `widget.json` (see `manifest.legacy-fields`).

### `manifest.missing-entry`

There is no `entry` — the page the widget starts from.

### `manifest.invalid-entry`

`entry` must be a path inside the archive (`index.html`, no leading `/`, no `.` or `..`) or an
`https://` address for a hosted widget.

### `manifest.missing-surfaces`

There is no `surfaces`. Say where the widget lives: `slot`, `window`, or both.

### `manifest.invalid-surface`

`surfaces` holds something other than `slot` and `window`.

### `manifest.invalid-window-scope`

`windowScope` can only be `app` or `tab`.

### `manifest.too-many-permissions`

More than 32 permissions. Keep the ones you need.

### `manifest.invalid-permission`

An unknown permission. Allowed: `marketData`, `account:read`, `trading`, `panels`, `notifications`,
`signalLevels`, `storage`.

### `manifest.too-many-egress`

More than 32 network addresses in `egress`. Cover subdomains with one `*.domain.com`.

### `manifest.invalid-egress`

An `egress` address is malformed. It must be a host (`api.example.com`), a host with a port, or
`*.example.com` — no `https://`, no path; local and numeric addresses are not allowed.

### `manifest.invalid-min-api-version`

`minApiVersion` must be a whole number, at least 1.

### `manifest.invalid-min-colibri-version`

`minColibriVersion` — the oldest Colibri the widget works on — is not three numbers. Write it like
`1.4.0`, with no suffix, or leave the field out when any terminal will do.

### `manifest.invalid-browser-permission`

`browserPermissions` holds a name that is not a browser permission, or more than 32 entries. A widget
may ask for `microphone`, `camera`, `clipboard-read`, `file-read-write` and `autoplay` — see
[Browser permissions](CAPABILITIES.en.md#browser-permissions). Terminal permissions such as `storage`
belong in `permissions`, not here.

### `manifest.forbidden-browser-permission`

`browserPermissions` names something widgets never get: `geolocation`, `notifications`, `sensors`,
`automatic-downloads`, `local-fonts`, `midi-sysex`, `window-management` or `persistent-storage`.
Remove it. For alerts declare the `notifications` permission in `permissions`; for data that must
survive a restart, `storage`.

### `manifest.invalid-icon`

`icon` is there and the icon path is over 256 characters. Better remove the field: the icon is set
on the widget in Nest (see `manifest.legacy-fields`). If you keep it, shorten the path.

## Integrity

### `hash.missing-directory`

Nothing to hash after extraction. Pack it again.

### `hash.too-many-files`

More than 2000 files. See `archive.too-many-files`.

### `hash.file-too-large`

A file is over 20 MB. See `archive.file-too-large`.

### `hash.bundle-too-large`

The content is over 50 MB. See `archive.bundle-too-large`.

### `hash.reparse-point`

The build holds a symbolic link or a reparse point. Put the files themselves in the folder.

### `hash.io-error`

The content could not be read to hash it. Send it again; if it repeats, write to us.

### `hash.mismatch`

The archive's content does not match the hash you gave. Pack it again and send the hash the terminal
showed.

## What the code does

### `manifest.legacy-fields`

A warning for your information only: unlike the others, it does not stop automatic approval.
`widget.json` holds `name`, `icon` or `author`. A widget's name, icon and author now live on the
widget in Nest: the name and the icon are set on the terminal's Author tab, in the widget's listing,
and the author is the owner's profile name. Nest never refuses these fields; with each it does this:

- `name` becomes the name of a new widget, once, and only when the upload itself creates the widget
  (an old Colibri sends a version with an id Nest does not know yet). Otherwise it is not read.
- `icon` becomes the widget's icon once: for a new widget, or for a draft that was never approved
  and has no icon yet. Colibri 1.3.0 or older sends versions the old way and cannot upload an icon
  on its own, so from it `icon` is still applied as the widget's icon on every upload. Otherwise it
  is not read.
- `author` is never read: the byline is the owner's profile name.

What to do: remove these fields from `widget.json` — the terminal's "Remove from widget.json" button
does it — and set the name and the icon in Nest. On Colibri 1.3.2 or older keep `name` — Nest
ignores it, and those releases need it to load the folder.

### `consistency.mismatch`

A warning. The `entry` file or the `icon` is missing from the archive or is the wrong kind of file
(`entry` is an `.html`, the icon an image). Nest checks the icon only when it will actually use it:
it seeds a new widget or a never-approved draft, or an old Colibri's upload applies it (see
`manifest.legacy-fields`). Check the paths in `widget.json`, or remove `icon`.

### `content.dynamic-code`

A warning. The code uses `eval`, `new Function`, `document.write` or loads code from another address.
A moderator will look at why; if you can do without it, remove it.

### `egress-code.undeclared-host`

A warning. The code calls addresses that are not in `egress`. The terminal blocks those requests. Add
the addresses to `egress` or remove the calls.

### `egress-ws.undeclared-host`

The code opens a WebSocket to an address that is not in `egress` — the terminal will not let that
connection through, and the widget will half-work. Add each address to `egress` (or a covering
`*.domain.com`).

### `egress-ws.unreadable`

The code in the archive could not be read, so its WebSocket addresses were not checked. Send it again.

### `egress-ws.unread-code`

A code file is too large to read, so its WebSocket addresses were not checked. Split the file and
send it again.

### `secrets.possible-secret`

A warning. The archive holds a string shaped like a key or a token. Never put keys in a widget:
anyone who installs it can read them.

### `embed.remote-shell`

A widget with `trading` or `account:read` is only a wrapper around someone else's page. The hash
covers the wrapper, not what actually runs. Make it a hosted widget (put the address in `entry`) or
drop the permission.

### `embed.remote-frame`

A warning. The widget's page embeds another site's page. If its address is not in `egress`, the
terminal will not load it.

### `embed.unreadable`

A `trading` or `account:read` widget's archive could not be read to check what it embeds. Send it
again.

### `av.flagged`

A warning. The scanner flagged something for a person to look at: obfuscation, wallet hooking,
sending data out. A moderator will review it.

### `malware.signature`

The archive matched a signature of known-malicious code. If you are sure this is wrong, write to us
with the rule id from the details.

## A hosted widget's network

### `egress.hosted-own-origin`

A hosted widget must list its own address in `egress` — that is where its page loads from.

### `origin.unreachable`

The hosted widget's address did not answer. Check the site is reachable over `https://`.

## Ownership and the version number

### `ownership.retired`

This id belonged to a widget that was published and later deleted; it is never issued again. Create
a new widget.

### `ownership.taken`

This id belongs to another author. Check the `id` in `widget.json` — the terminal writes it for you.

### `ownership.version-not-after`

The version number is not above the highest this widget ever had, declined, waiting and withdrawn
versions included: numbers only grow and never repeat. Raise the number. The only number that stays
free is one whose archive failed the automatic checks — that version was never stored.

## The listing

### `editorial.category`

A new widget has no category, or one that is not on the list. Choose a category.

### `editorial.description`

A new widget has no description. One is needed, in Russian or English.

## Refusals outside the checks

### `check.could-not-run`

A blocking check could not run on this archive. Send it again; if it repeats, write to us.

### `submission.no-author-name`

The author has no name. Fill in the author profile and send again.

### `submission.widget-removed`

The widget was deleted while this version was being checked. There is nothing to send it to.

### `submission.internal`

Nest could not process the submission — our fault, not your archive's. Send it again later.

### `submission.withdrawn`

You withdrew this version from review. Its number stays used: the next version gets a higher one.

## A moderator's decisions

A moderator declines a version with one of the reasons below and always writes a note: what exactly
is wrong in your widget. The note is the first message of that version's conversation; you can
answer there. While a version waits for review, the terminal shows when an answer usually comes —
a target, not a promise. If it has passed, write to the moderator in the same conversation.

### `review.excess-permissions`

The widget asks for permissions or network addresses it does not need. Keep only the ones it uses.
The rule: [what may be published](policies/CONTENT.en.md).

### `review.misleading-listing`

The name, icon or description does not match what the widget does. The rule:
[what may be published](policies/CONTENT.en.md).

### `review.hidden-code`

Code is hidden from review: obfuscation for its own sake, code loaded at run time. Only what is in
the archive is reviewed. The rule: [what may be published](policies/CONTENT.en.md).

### `review.content-policy`

The widget breaks the content policy. The rule: [what may be published](policies/CONTENT.en.md);
what happens to a widget taken down: [takedowns](policies/TAKEDOWN.en.md).

### `review.broken-widget`

The widget does not work. Try it in the terminal on a clean install.

### `review.other`

Something else — the moderator's note says what.
