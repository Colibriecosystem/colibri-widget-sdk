# Nest checks: what a refusal means and how to fix it

Every Nest refusal names itself with a stable code. The terminal turns the code into a title, a hint
and a link here, to the rule with that code. For each code this page says what it means, why it
works that way, and what to do.

> Русская версия: [CHECKS.md](CHECKS.md)

How to read a result:

- **Refused by the checks** — the archive failed an automated check. The version was not stored, so
  you can send the same version number again once it is fixed.
- **Warning** — a check found something a person should look at. It does not stop the submission,
  but there is no automatic approval: a moderator reviews the version.
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

The file does not open as a zip, or it is damaged. Release the version again from the Author tab — the
wizard builds the archive exactly the way Nest checks it.

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

There is no `id`. Put in your widget's ID — the one it was created under on the Author tab.

### `manifest.invalid-id`

`id` does not fit: lowercase Latin letters, digits and hyphens, at most 40 characters, not starting
or ending with a hyphen.

### `manifest.id-mismatch`

The archive names a different widget than the one the version was sent to. Nest takes a version
only into the widget whose ID is in `widget.json`. Put this widget's ID into `widget.json` — or,
while the widget has no version yet, let it take the folder's ID (Author → Code) — and send it again.

### `manifest.missing-name`

There is no `name`.

### `manifest.invalid-name`

`name` is empty or over 64 characters.

### `manifest.missing-version`

There is no `version`.

### `manifest.invalid-version`

`version` is not a number like `1.2.3` (a suffix like `-beta.1` is fine), or it is over 32 characters.

### `manifest.invalid-author`

`author` is over 64 characters.

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

### `manifest.invalid-icon`

The icon path is over 256 characters.

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

### `consistency.mismatch`

A warning. The `entry` file or the `icon` is missing from the archive or is the wrong kind of file
(`entry` is an `.html`, the icon an image). Check the paths in `widget.json`.

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

The version number is not above the highest this widget ever had, declined and waiting versions
included. Raise the number.

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
