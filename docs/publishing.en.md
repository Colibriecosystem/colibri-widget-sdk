# Publishing and review in Nest

> Русская версия — [publishing.md](publishing.md).

Everything an author does with a widget in Nest is on the Nest window's **Author** tab: the profile
and keys, a page per widget, releasing versions, review and access. This page describes every screen
of the tab. The step-by-step path from a template to the catalog is in
[getting-started.en.md](getting-started.en.md).

The tab is laid out like this. At the top is the author bar: **New widget**, the **Notifications**
bell and **Profile**. On the left: **All widgets** (a summary: where each widget stands and what to
do next), your widgets under **My listings**, and **Profile and keys** at the bottom. On the right,
the page you picked. A widget's page has seven sections: **Overview**, **Versions**, **Listing**,
**Code**, **Access**, **Stats** and — for partners only — **Announcement**.

## <a id="author"></a>The author

Nest has no sign-in and no password. An author is a profile in Nest plus an **author key** on a
computer: with that key the terminal publishes as you.

**Becoming an author.** Nest → **Author** → the **Become an author** form:

| Field | Who sees it | What it is |
| --- | --- | --- |
| **Display name** | everyone | Required. Every widget of yours is signed with it — in the catalog and on the widget's page. |
| **YouTube channel**, **Telegram channel** | everyone | Optional. Shown next to your name on every catalog row and on every widget's page. YouTube is youtube.com or youtu.be, Telegram is t.me. |
| **Email** | Nest moderators only | Required. So we can reach you about your widgets: a takedown, a reported problem. |
| **Telegram for contact** | Nest moderators only | Optional. Written as `@handle`. |
| **Source code link** | Nest moderators only | Optional. `https://` only. |

Click **Become an author**. Nest issues a key for this computer and shows it once on the
**Author key on this computer** card: **Copy**, **Set up recovery** and **I saved it**. Why the key
matters and how not to lose it is [the next section](#author-key).

**The profile.** **Profile** in the author bar, or **Profile and keys** at the bottom of the list.
The fields are the ones you created the author with; **Save** sends changes to Nest, **Revert**
brings back what is saved. The byline under all your widgets is your current **Display name**:
change it and the byline changes everywhere. `widget.json` carries no author, name or icon: the name
and the icon live with the widget in Nest, the byline in the profile
([`manifest.legacy-fields`](../CHECKS.en.md#manifestlegacy-fields)).

**Co-maintainers.** The **Co-maintainers** section of the profile page. The owner clicks
**Invite a co-maintainer**, enters a name and clicks **Create the invitation** — Nest issues a
one-time code valid for 7 days. The co-maintainer pastes it on their own computer under
**I have a key or a code**. A co-maintainer releases versions, edits listings and answers moderators
on the author's behalf. The profile, keys, co-maintainers, recovery, withdrawing a widget,
deprecating, transferring and deleting stay with the owner: a co-maintainer sees those buttons
disabled, marked **The author’s owner only**. **Remove** on a co-maintainer turns off all their keys
at once; the versions they released stay.

**Notifications.** The bell in the author bar: what moderators and Nest did to your widgets —
decisions on versions, moderator replies, takedowns, answers to a catalog request, a moderator's
edits to a listing, notices from Nest to all authors. Your own actions do not show there. Takedowns
and revocations also arrive by email.

**Another identity.** **Create a new author** makes a second author, say to publish under another
name; the new key replaces the key on this computer, so copy the current one first.
**Use a different author key** switches to another author's key or code.

## <a id="author-key"></a>The author key: another computer and recovery

The key belongs to a computer, not to a person: each of your computers gets its own key for the same
author. The key is how Nest knows your widgets are yours and stops anyone else updating them — and
equally how it lets in anyone who holds it. Keep it like a password.

The author's keys are under **Profile and keys** → **Devices and recovery**: which computer, when it
was added and when it last talked to Nest. **Rename** gives a key a name you will recognize.
**Turn off** disables the key of a lost or unknown computer at once and for good — it cannot be
brought back, only a device added again.

| Task | What to do |
| --- | --- |
| Work from another computer too | **Add a device** → a one-time **Code for another computer**, valid for a limited time. On that computer: Nest → **Author** → **I have a key or a code** → paste the code, adjust **This computer’s name** if you like → **Continue**. That computer gets its own key. |
| Insure against loss | **Set up recovery** → a **Recovery code**, shown once. Keep it off this computer — in a password manager or on paper — and click **I saved the code**. **Create a new code** cancels the old one. |
| Every computer is lost | On a new computer: **I have a key or a code** → the recovery code → **Continue**. Then create a new recovery code and turn off the keys you do not recognize. |
| A second way back: email | **Confirm the e-mail** under **Devices and recovery**. Then **Recover by e-mail** under **I have a key or a code** mails a code to it, if Nest has recovery by email switched on. |
| You kept the key itself | Paste the key into the same **I have a key or a code** box: Nest checks it before the terminal keeps it. |
| Stop publishing from this computer | **Forget the key on this computer** — this computer only. In Nest the author and all the widgets stay, and the key keeps working until it is turned off under **Devices and recovery**. |

Without a recovery code, a confirmed email or a second computer, a lost key cannot be recovered: a
lost computer is a lost author. Set up recovery on the first day.

## <a id="widget-id"></a>The widget's ID

The ID is the `id` field in `widget.json` and the widget's ID in Nest. It is also the name of the
install folder and part of the widget page's address (`https://<id>.widgets.colibri.internal`), so
the rules are strict: lowercase Latin letters, digits and hyphens, 1 to 40 characters, no hyphen at
the start or the end. The field in the reference:
[reference/manifest.en.md#manifest-id](reference/manifest.en.md#manifest-id).

- **You write the ID, with the code.** The terminal never asks for it. It suggests an ID from the
  name only where it creates the code itself: **From a template** and **A website (hosted)** on the
  **Code** section.
- **A draft takes its ID from the code.** **New widget** asks only for a name, and until code is
  linked the draft has no ID — next to **ID** it reads **set once its code is linked**. Link a
  folder and the draft gets the ID in its `widget.json`.
- **While there is no version, the ID can change.** Link a folder with a different ID — the terminal
  asks, and after **Change the id** renames the draft; the old ID is freed. An upload refused by the
  automatic checks does not count: that version was never stored.
- **With the first version the ID becomes permanent.** Every later version must carry it in
  `widget.json`: the release wizard will not pack a folder with another ID, and Nest refuses such an
  archive ([`manifest.id-mismatch`](../CHECKS.en.md#manifestid-mismatch)).
- **Taken IDs.** Another author's ID will not do
  ([`ownership.taken`](../CHECKS.en.md#ownershiptaken)). The ID of a published widget that was later
  deleted is never issued again ([`ownership.retired`](../CHECKS.en.md#ownershipretired)). A draft
  that was never approved frees its ID when you delete it.

## <a id="hosted"></a>Hosted or bundled

A widget is either files in an archive (**bundled**) or your site (**hosted**). Decide before the
first line of code: moving between them costs more than anything else.

If you **already have a working web app on your own https domain**, take hosted. `entry` points at
your address, there is nothing to build or pack, and you ship updates on your own server without
releasing versions. Authors who already have a site still tend to build a bundle — extra work that,
in their case, buys almost nothing. If there is no site, take bundled: only it gives a pinned hash,
a widget that works without your server, and no dependency the user installs separately.

| | Hosted | Bundled |
| --- | --- | --- |
| `entry` | your https address | a file in the folder |
| How to link it | **Code** → **A website (hosted)** | **Code** → **Project folder** or **From a template** |
| Updates | you ship them on your server, no release | a new version |
| Catalog, consent, revocation, theme, one-click install | yes | yes |
| Catalog badge | amber **hosted** | green **bundled · hash ✓** |
| Works without your server | no | yes |
| Review | a moderator looks at every version | an update that changes only code may be approved without a person ([more](#review)) |

The honest difference of hosted: its identity is the site's address, not a content hash. Whatever
your server serves tomorrow is what runs on the user's machine. That is why hosted is never approved
automatically.

**Linking a site.** **Code** → **A website (hosted)** → **Enter the address**: **Address**, **ID**
(suggested from the name, changeable until a version exists) and **Where it shows**, then **Link**.
The terminal builds the `widget.json` itself and loads the site as a widget. If you installed this
site by its address on this computer before, **Take from installed** fills the form in.

The manifest starts minimal: both surfaces, no permission at all, only the site's own host. Open the
widget and go through its features: whatever the terminal refused the site shows up under
**The site tried — and was refused** — **Add** one at a time or **Add all**. The rest goes under
**Set by hand**: the permissions and **More hosts, comma-separated**, then **Apply**. The
**Permissions and hosts** list is a ceiling: whatever is not on it the terminal blocks for every
user. Only the address, the permissions and the hosts go to Nest; you update the site itself without
a release.

A hosted widget's release wizard has three steps and no archive: **1 · Number**, **2 · What's new**
and **3 · Send**. Before sending it warns you if the site asked for something the manifest does not
declare. The automatic checks open your site — it must answer over https
([A hosted widget's network](../CHECKS.en.md#a-hosted-widgets-network)). A new address is
**Change the address** and a new version.

**Do not wrap your site in a bundle.** A bundle whose entire entry document is an `<iframe>` of your
site is hosted wearing bundled clothes. Nest detects it with a check of its own, the card still gets
the amber badge naming the embedded site, and if such a widget asks for `trading` or `account:read`,
the version is **refused automatically**
([`embed.remote-shell`](../CHECKS.en.md#embedremote-shell)). The green badge is earned only by code
that actually ships in the archive: the hash covers what arrived in the archive, not what your
server will serve tomorrow.

The architectural side of the choice is in
[CAPABILITIES.en.md, "How to pick an architecture"](../CAPABILITIES.en.md#how-to-pick-an-architecture).

## <a id="overview"></a>Overview

**Overview** opens first. At the top is the **WHAT NEXT** card: one next step and a button for it.
For a draft it goes in order: **Link it to your code** (button **Link the code**), then
**Fill in the listing** (**Fill in the listing**), then **Ready for the first version**
(**Release the first version**). After that it says where the widget stands: checks running, a
version waiting for a moderator (**Open the version**), a version declined, the widget in the
catalog or installable by link, withdrawn by you or by a moderator.

Until a version is approved, next to it is **Ready for the first version**, with a count of the
required items. **Fill in** next to an item opens the section it needs.

| Item | Required | Where |
| --- | --- | --- |
| **Name** | yes — there since the draft was created | **Listing** |
| **Icon** | yes | **Listing** |
| **Category** | yes | **Listing** |
| **Description (EN or RU)** | yes | **Listing** |
| **Code linked** | yes | **Code** |
| **Long description** | **recommended** | **Listing** |
| **Screenshots** | **recommended** | **Listing** |
| **At least one link** | **recommended** | **Listing** |

The recommendations never hold a release back. The release wizard itself stops only without a
category and a description: Nest does not accept a first version without them
([The listing](../CHECKS.en.md#the-listing)). The rest is a person's judgement:
**A moderator reviews the first version together with the listing.**

Once the first version is approved, the readiness card gives way to the **Versions** card
(**current**, **in review** and **in the folder** — the number in the linked `widget.json`;
**All versions** opens the section) and the **Stats** card.

The page header shows the name, the widget's state (**Draft — no version yet**,
**Waiting for review**, **In the catalog**, **By link only**, **Withdrawn by you**,
**Taken down by a moderator**) and what waits for a decision: a version, a new name,
**The new icon is waiting for a moderator**, **Catalog requested**, **Deprecated**,
**Transfer waiting**. It also has the **ID** with a copy button, and the **Release a version** and
**Copy link** buttons.

**All widgets** is a table — **Widget**, **State**, **Version**, **What next**, **Installs** — with
the widgets that wait for you under **Needs your attention**. Folders loaded on this computer but
linked to no widget are listed under **LOCAL, NO DRAFT YET**: **Create a draft from this folder**
turns one into a draft with the ID from its `widget.json`.

## <a id="listing"></a>Listing

**Listing** is the widget's presentation: its row in the catalog and its page in Nest. Everything
here changes without a new version. Permissions, network and the version number do not change here:
they come from the approved version's `widget.json` and change only with a new version — the
**Permissions and package** block is read-only.

**Basics** — the catalog card:

- **Name** — what the widget is called everywhere it shows.
- **Icon** → **Choose icon…**. PNG, JPEG, WebP, GIF, BMP or ICO up to 512 KB, each side 32 to 1024
  px; SVG is not accepted. A 128×128 square on a transparent background works best: the icon is
  drawn at most 44×44, in the page header, and 22–26 px in lists. The terminal checks the picture
  before uploading and saves it at once. The icon shows everywhere the widget does: the catalog and
  the widget's page, **My widgets**, panel and window headers, the bookmark in the bottom bar.
  Without one, 🧩 is drawn everywhere.
- **Version** — the approved version's number, read-only.
- **Category** — one per widget, from Nest's list: **Alerts**, **Analytics**, **Market data**,
  **Trading**, **Portfolio**, **Research**, **Productivity**, **Other**. The catalog groups widgets
  by it.
- **Tags** — your own, comma-separated, as many as you like; shown exactly as written. Use them for
  what the widget can do, not for keywords.
- **Interface languages** — the languages the widget itself speaks; shown on its page.
- **Description (RU)** and **Description (EN)** — the short description, the catalog line: up to 400
  characters, no markup. A first version needs at least one.

**Description** — the widget's page:

- **Long description (RU)** and **Long description (EN)** — headings (`# `), bullets (`- `) and
  paragraphs; links and images show as plain text. The page first shows two lines, so lead with what
  matters.
- **Features** — up to six blocks: a title and an explanation of up to 280 characters, in both
  languages. **Add a feature**.

**Media** — saved as soon as it uploads; it needs no **Save**:

- **Screenshots** — up to five, PNG, JPEG or WebP up to 2 MB, each side 320 to 3840 px, 1280×800 is
  best. The first leads the page.
- **Cover** — the banner at the head of the widget's page, 8 : 3 (for example 1600×600), 1200 to
  3200 px wide, PNG, JPEG or WebP up to 2 MB.
- **Video** — a link to one YouTube video, a minute or less is best.

**Links and support** — https only: **Website**, **Documentation**, **Support**,
**Terms and privacy**, **Telegram** (t.me) and **YouTube**. The author's channels from the profile
show beside the byline separately.

**Save** sends the texts, **Revert** drops what is unsaved. On the right, under **In the catalog**,
is the catalog row as you type; **As users will see it…** opens the widget's page with your unsaved
edits.

**What waits for a moderator.** For a draft, and for a widget that was never in the public catalog,
everything applies at once. For a widget that was in the catalog, a new name and a new icon wait for
a moderator: until they decide, the catalog keeps the old ones, and the page header says what waits.
Leaving the catalog does not get round it. Everything else applies at once and users see it at once;
a moderator may check it afterwards and remove what does not belong — the reason then arrives in
**Notifications**. A listing that does not match the widget is a reason to decline a version
([`review.misleading-listing`](../CHECKS.en.md#reviewmisleading-listing)).

## <a id="release"></a>Releasing a version

**Release a version** (for a new widget, **Release the first version**) is in the widget page's
header, on the **Versions** section and on the **WHAT NEXT** card; after a refusal,
**Send a new version…** sits by the version's row. The release wizard opens over the tab. The button
is gone while a version is being checked and on a withdrawn widget. Code must be linked to the
widget — a folder or a website address.

The wizard's steps: **1 · Number**, **2 · What's new**, **3 · Archive** and **4 · Send**. A hosted
widget and a rollback have no archive step — three steps. **Back** and **Next** move between steps;
**Cancel** closes the wizard and puts the previous number back into `widget.json`.

If `widget.json` still has `name`, `icon` or `author`, the wizard says so and offers
**Remove from widget.json**. It never stops the release
([`manifest.legacy-fields`](../CHECKS.en.md#manifestlegacy-fields)).

### <a id="release-version"></a>The version number

- `version` is three numbers `X.Y.Z`, no leading zeros and no suffix: `1.2.3`, not `v1.2.3`, `1.2`
  or `1.2.3-beta.1`. Nest has no pre-release channel: every approved version reaches every user.
- Numbers only grow and never repeat. A new version must be above every one the widget ever had:
  approved, waiting for review, declined by a moderator and withdrawn by you from review. The only
  free number is one whose archive the automatic checks refused: that version was never stored.
  Going back to an earlier version is a new, higher number too.
- Which part to bump: `Z` — **fix**; `Y` — **new features**, users have nothing to do; `X` —
  **breaking changes**: users will have to do something — agree to new permissions or addresses,
  update Colibri, set the widget up again.

For a first version the wizard offers the number in `widget.json` — **as in widget.json** (or
`1.0.0` when there is no usable one). After that it offers **fix**, **new features** and
**breaking changes** past the highest number the widget ever had, and **another number**. If
`widget.json` already holds a number past the highest, it comes first. When users will have to act —
a new permission, host or site address, a raised `minColibriVersion` or `minApiVersion` — the wizard
puts **breaking changes** first and says why. A number that breaks a rule does not get past the
wizard, which names the rule.

The number is written into `widget.json` when the archive is packed and put back if you cancel the
release. In a Vite project it also goes into `public/` and `dev/widget.json` —
[getting-started.en.md#react](getting-started.en.md#react). For a hosted widget the number goes into
the manifest the terminal builds.

- `minColibriVersion` is optional: the oldest terminal the widget works on, three numbers
  (`"minColibriVersion": "1.4.0"`). Terminals newer than 1.3.1 do not install, offer as an update or
  run a version that needs a newer Colibri: the user sees which Colibri it needs, and the version
  they already have keeps working. Terminals up to 1.3.1 do not read the field. A pre-release
  terminal build (`1.4.0-beta.2`) counts as `1.4.0`. The field:
  [reference/manifest.en.md#manifest-min-colibri-version](reference/manifest.en.md#manifest-min-colibri-version).
- `minApiVersion` is something else: the version of the `window.colibri` contract, which grows only
  with breaking API changes. If the widget needs something from Colibri 1.4, write
  `minColibriVersion`. The field:
  [reference/manifest.en.md#manifest-min-api-version](reference/manifest.en.md#manifest-min-api-version).

Refusals about the number:
[Ownership and the version number](../CHECKS.en.md#ownership-and-the-version-number) and
[The `widget.json` manifest](../CHECKS.en.md#the-widgetjson-manifest).

### <a id="release-notes"></a>What's new

**What's new — Russian** and **What's new — English**, up to 1000 characters each. Required in at
least one language for an update, optional for a first version. Users see "What's new" before they
update: on the widget's row in **My widgets**, next to the update button, and on the widget's page
in the catalog, with every earlier note under **Version history**. Write what was fixed and what is
new, not how it was done.

You can fix the text after the release too, with no new version and no review: **Versions** →
**Edit “What's new”**.

If a new widget has no category or description, the wizard stops at this step and sends you to
**Listing**: a first version without them does not pass review.

### <a id="release-build"></a>The archive

After **Packing the folder…** the wizard shows **Version** marked **written into widget.json**, the
archive's **Size** and **SHA-256**, and below them **What changes for users** compared with the
version users have now: permissions added and removed, browser permissions, network addresses,
surfaces, a raised `minColibriVersion`. If only the code changes, it says so: users are not asked
anything again. A new permission or a new host means users are asked again when they update, and a
moderator always reviews such a version. The last line says who will review it.

**What goes into the archive.** The whole linked folder — everything in it. So link the folder that
holds the finished widget (`widget/` or `dist/`), not a project root with its README, `.git` and
`node_modules`. Limits: an upload of up to 64 MB, and in the archive up to 2000 files, up to 20 MB a
file and up to 50 MB in total once unpacked. Symbolic links are not allowed. A folder whose `entry`
points at a dev server cannot be packed: there is nothing to distribute.

**The hash.** The archive is pinned by a **content hash**. The contract is over the unpacked
content, never the archive's bytes: unpack the archive into a folder, hash it, and you get the same
value. So the hash reproduces on any machine with any archiver: timestamps, entry order and
compression level cannot affect it. The hash is SHA-256 over the concatenation, for each file in
ordinal path order, of `UTF-8(relative path) ‖ 0x00 ‖ int64-LE(length) ‖ SHA-256(bytes)`. Paths use
forward slashes, and empty folders contribute nothing. A terminal that installs the version checks
the same hash and refuses to run an archive in which even one byte changed.

The refusals of this step: [Size and archive](../CHECKS.en.md#size-and-archive) and
[Integrity](../CHECKS.en.md#integrity).

### <a id="release-submit"></a>Sending

**Where to offer it** — **In the catalog** or **By link only**, on every release; where the widget
is now is marked **now**.

- **A first version.** It defaults to the catalog: once a moderator approves it, everyone can find
  it there. **By link only** — only people with your link can install it, and the catalog can be
  asked for later.
- **An update.** Staying where it is changes nothing. Moving into the catalog is a request: the
  moderator decides it together with this version. Leaving the catalog happens as soon as the
  version passes the automatic checks, with no moderator; installed copies keep working.

**Send for review** — the wizard closes on the **Versions** section, and the new version's row reads
**Being checked**. How the catalog differs from a link: [below](#catalog-or-link).

## <a id="review"></a>Review

Once sent, a version goes through the automatic checks on Nest's server — usually a minute or two;
meanwhile its row reads **Being checked**. The checks run in order, and the first one that refuses
stops the rest. A refusal names its stage as it is labelled below, its code and what to fix, and
**About this rule** leads to the rule in [CHECKS.en.md](../CHECKS.en.md).

1. **Size** and **Archive** — an upload of 64 MB at most, a readable zip, no path leaving the
   archive's root, no more than 2000 files, none over 20 MB, 50 MB in all. Rules:
   [Size and archive](../CHECKS.en.md#size-and-archive).
2. **Manifest** and **Permissions** — `widget.json` sits at the archive's root and parses; `id`,
   `version`, `entry`, `surfaces`, `permissions`, `egress` and `browserPermissions` are valid.
   Rules: [The `widget.json` manifest](../CHECKS.en.md#the-widgetjson-manifest).
3. **Integrity** — Nest unpacks the archive, hashes the content again and compares it with what the
   terminal showed. Rules: [Integrity](../CHECKS.en.md#integrity).
4. **The code** — **Consistency**, **Code**, **Network in code**, **WebSocket hosts**, **Secrets**,
   **CSP**, **Embedded pages**, **Scanner review** and **Malware**. Almost everything here is a
   warning for the moderator: the `entry` file is there, there is no `eval` and no code loaded from
   elsewhere, the addresses in the code are declared in `egress`, the archive holds no keys or
   tokens, the page is not a wrapper around someone else's site, the scanner found nothing
   suspicious. Three things refuse: a WebSocket to a host missing from `egress`; a wrapper around
   another page with `trading` or `account:read`; a match with a known malware signature. Rules:
   [What the code does](../CHECKS.en.md#what-the-code-does).
5. **Network** and **Hosted site** — hosted only: the site's own address is in `egress`, and the
   site answers over https. Rules:
   [A hosted widget's network](../CHECKS.en.md#a-hosted-widgets-network).
6. **Ownership** — the ID is yours or free, and the number is above every one the widget ever had.
   Rules: [Ownership and the version number](../CHECKS.en.md#ownership-and-the-version-number).
7. **Listing** — a new widget has a category and a description. Rules:
   [The listing](../CHECKS.en.md#the-listing).
8. **The moderator** — a person judges what a machine cannot: whether the widget needs its
   permissions and addresses, whether code is hidden, whether the listing is honest, whether the
   widget works. Reasons for declining:
   [A moderator's decisions](../CHECKS.en.md#a-moderators-decisions).

Refusals that belong to no check — a check that could not run, a deleted widget, a Nest error — are
in [Refusals outside the checks](../CHECKS.en.md#refusals-outside-the-checks).

**Three different outcomes.**

| What you see | What it means | What to do |
| --- | --- | --- |
| **Refused by checks** | An automatic check refused. The version was not stored. | Fix it and send again — the same number works. |
| A warning | A check found something a person should look at. It does not stop the upload, but there is no automatic approval. | Wait for the moderator. The exception is [`manifest.legacy-fields`](../CHECKS.en.md#manifestlegacy-fields): it is only a note. |
| **Declined** | A moderator declined the version. It was stored, and its number is taken. | Answer in the conversation; send the fixed code under the next, higher number. |

**The moderator.** A moderator reviews every widget's first version together with its listing. While
the version waits, its row reads **In review** and says by when an answer usually comes — a target,
not a promise. Past it the row reads **In review · late**: write to the moderator in the version's
conversation. The decision arrives in **Notifications**, and an approved version becomes
**Current**.

**When a version is approved without a person.** Colibri may trust an author, or a single widget:
then an update that changes only a bundled widget's code is approved automatically once it passes
every check. Colibri grants that trust. The terminal never tells an author whether they are trusted,
and an automatic approval arrives in **Notifications** exactly like a moderator's. A person always
looks when:

- it is the widget's first version;
- the widget is hosted: its code is not covered by the hash;
- the version changes what users agreed to: permissions, browser permissions, network addresses,
  surfaces, `minApiVersion`, the site's address;
- any check warned (other than the `manifest.legacy-fields` note) or could not run;
- it is the first version after the widget moved to a new owner.

A request for the catalog is always decided by a person — even when the version itself was approved
automatically.

**Talking to the moderator.** On the **Versions** section, expand the version's row: it shows the
state, the refusal's details (**Details**) and the conversation with the moderator — a field for
your answer and **Send**. When declining a version, the moderator picks a reason and writes a
comment about your widget — that comment is the conversation's first message. A moderator's reply
arrives in **Notifications**. Once the version is approved, the conversation closes.

## <a id="versions"></a>Versions

**Versions** lists every version sent, newest first. Each row has the number, the state, when it was
sent and when it was decided, and the first line of "What's new". The states: **Being checked**,
**In review**, **In review · late**, **Current** (the one users get), **Approved**, **Declined**,
**Refused by checks** and **Withdrawn**. Expand a row to see the whole "What's new",
**What changed for users**, a refusal and the conversation with the moderator.

- **Edit “What's new”** (the pencil) — the text changes with no new version and no review, and is
  saved at once.
- **Withdraw** — only while the version waits for review: the moderator stops reviewing it. Its
  number stays taken, and the next version gets a higher one. Users keep getting the current
  version.
- **Roll back** — on an approved version that is not the current one. The release wizard, in three
  steps, releases its code again under a new, higher number: Nest uses its own copy of the approved
  archive, and your folder does not change. The row of such a version says which version it returns
  to. For a hosted widget the address, permissions and hosts of that version come back, but the site
  itself is not rolled back. A rollback is reviewed like any version.

An author cannot pull an approved version from users — catalog numbers only grow. A bad release is
cured by rolling back to the earlier code, or by withdrawing the whole widget under **Access** →
**Withdraw**.

**What users see.** An update arrives in **My widgets**: the widget's row offers the update and
shows "What's new". The widget's page in the catalog shows the current version's "What's new" and
**Version history**: every approved version with its date and notes. A version that asks for more
asks for consent again on update. Older terminals are not offered a version that needs a newer
Colibri, and the version they have keeps working. If Nest revokes a version (see
[TAKEDOWN.en.md](../policies/TAKEDOWN.en.md)), the widget is switched off wherever that version is
installed.

## <a id="access"></a>Access

**Install link.** It appears after the first upload and works once the first version is approved;
**Copy** is next to it, and **Copy link** is in the page header. Anyone with the link can install
the widget, in the catalog or not: Nest → **My widgets** → **Add a local widget…** → paste the link
→ **Continue**. One link serves every version of the widget.

**Visibility** — **In the catalog** or **By link only**. It is first chosen when the first version
is released. Once a version is approved, it switches here, without a release (a co-maintainer can
switch it too):

- **By link only** — after a confirmation the widget leaves the catalog at once and installs by link
  only. Where it is installed, it keeps working and updating. Going back to the catalog is through a
  moderator again.
- **In the catalog** — a request to a moderator. While it waits, a line below says so; changed your
  mind? Pick **By link only** and the request is withdrawn.

**Publication.** The owner's actions:

- **Withdraw** — take the widget out of the catalog. Nobody installs it anew, not by link either;
  installed copies keep working but get no more updates. **Restore** brings it back at any time. A
  widget a moderator took down (**Taken down by a moderator**) only a moderator can bring back; the
  reason is on **Overview**.
- **Mark as deprecated** → **Mark deprecated…** → pick a replacement from the public catalog, or
  **No replacement** → **Mark deprecated**. Users see the **Deprecated** mark and, if you named one,
  the replacement. The widget stays in the catalog and keeps working, but it sorts below the others,
  and a fresh install asks the user first. **Change the replacement…**, **Remove the mark**. The
  replacement is named to users only while it is in the public catalog itself.
- **Transfer ownership** → **Hand over…** → **Get a code**: a one-time code valid for 7 days, shown
  once. The new owner enters it on their own **Author** tab: **New widget** →
  **I have a transfer code** → **Check** → **Accept the widget**. Every version and its "What's
  new", the listing, the icon, the stats and the install link go with the widget. You keep your
  uploads, your conversations with moderators and your notifications. Trust does not move: a
  moderator looks at the new owner's first version. The **✓ Colibri** and **Partner** marks are
  removed. Users see that the owner changed, and the widget keeps working for them. Only a widget
  with an approved version can be handed over; while a version is being checked or waits for a
  decision, and while the widget is taken down, the transfer is not available. **New code…** and
  **Cancel the transfer** work until the code is used.
- **Delete** — a draft that was never approved only: for good, with its ID. A widget people may have
  installed cannot be deleted — withdraw it instead.

## <a id="stats"></a>Stats

**Stats** is what Nest counts for the widget. A number Nest does not have is not shown: it does not
turn into a zero. Until people install the widget, there are no numbers.

- **installs**, **installed now**, **used in 7 days** — the totals.
- **Installs over 30 days** — installs and uninstalls by day on one scale, with the month's sum.
- **Used by day** — how many terminals opened the widget that day; yesterday shows up by the
  morning.
- **Versions in use** — how many installs run each version now, by each terminal's latest report.

Everything is counted by closed UTC days and refreshed hourly. A day not counted yet breaks the line
rather than drawing as zero. Errors users' widgets hit are not shown here.

## <a id="announcement"></a>Announcement

The **Announcement** section appears for a widget in the public catalog when the widget is marked as
a partner's or its author is a Colibri partner (the **Partner** mark). Colibri sets the marks. An
announcement is a short message to Colibri users about a release, a promotion, maintenance or a
stream. Users see it under **Partner announcements** in the Nest window, with the widget's icon and
name; clicking it opens the widget's page. An announcement from the author rather than a widget is
on the **Profile and keys** page, and only the owner publishes it.

- **Title, RU**, **Title, EN** — up to 80 characters; **Text, RU**, **Text, EN** — up to 500. One
  language is enough: users see theirs, or the other one when theirs is missing.
- No links or contacts in the text or on the picture, no promises of returns, no trading signals and
  no one else's advertising.
- **Link** — optional, and only to a stream or a video: YouTube, Twitch, Binance Live, VK Video,
  Rutube, Kick or a Telegram channel. Users see a button named after the platform, not the address.
- **Picture** — optional: 16 : 9, 1280×720 is best, PNG, JPEG or WebP up to 2 MB, no links or QR
  codes.
- **Show for** — 1 to 14 days.

**Publish** — users see the announcement at once, and a moderator looks at it afterwards. One
announcement shows at a time: a new one replaces the current one, which moves to
**Past announcements**. Under **Users see now** are **Change…** and **Take down**. If a moderator
takes an announcement down, the reason arrives in **Notifications**.

## <a id="local-install"></a>Installing without Nest

Everything that is not installed from the catalog is installed from one dialog: Nest →
**My widgets** → **Add a local widget…**. It is a full install — the content hash pinned at install,
permissions granted through the consent dialog, an on/off switch and one-click revocation. An
archive and a web app by its address install on this computer only, with no Nest review and no
updates from Nest. A folder you are developing does not belong here: it is linked on the **Code**
section of the **Author** tab.

**From a zip archive.** **Install from zip…** installs an archive with `widget.json` at its root. It
guards against paths that leave the archive, limits the unpacked size (2000 files, 20 MB a file, 50
MB in all), and always deletes its temporary folder. The hash is computed over the unpacked content,
so an archive built with any zip tool gives the same hash.

**From a link to a .zip.** Paste an https link ending in `.zip` into the field and click
**Continue**. The terminal downloads the archive over its own chain of routes — a direct connection,
then your proxies, 64 MB at most — and takes it down the same path as a zip: the same consent, the
same hash from the unpacked content.

**From an install link.** The author of a by-link-only widget gives you the link from their
**Access** section. Paste it into the same field and click **Continue** — the terminal installs the
approved version from Nest, with the usual consent. If the link does not work, the widget may have
been withdrawn or revoked, or the link is wrong.

**A running web app — just its address.** If the link does not end in `.zip` and does not lead to
Nest, the dialog opens a form: **Name**, **ID** (derived from the name, editable), **Version**,
**Surfaces** (slot, window), **Permissions** and **Extra network hosts (comma-separated)**. The
link's own host always goes into `egress`. The terminal mints a one-page `widget.json` itself and
installs it as a hosted widget. For example, the address `https://screener.example.com/app/`,
version `1.0.0`, permission to send notifications and keep its own storage, and the extra host
`api.example.com` become this manifest:

```json
{
  "id": "my-screener",
  "version": "1.0.0",
  "entry": "https://screener.example.com/app/",
  "surfaces": ["slot", "window"],
  "permissions": ["notifications", "storage"],
  "egress": ["screener.example.com", "api.example.com"]
}
```

The name stays on this computer and does not go into `widget.json`, and such an install has no icon
— it shows 🧩 everywhere. Its identity is the address, not a hash: whatever that address serves
tomorrow is what runs, which is why the widget carries the **hosted** badge. To publish the site in
Nest, link it on the **Author** tab: **Code** → **A website (hosted)** — **Take from installed**
fills in what you entered here ([above](#hosted)).

DevTools are off for installed widgets. Turn them on in Nest → **Settings** →
**Developer tools for installed widgets**; a linked folder always has them.

## <a id="catalog-or-link"></a>Catalog or link

Approval and the catalog are two different decisions. Every version needs a moderator's approval
however it is installed: until then nobody can install it, from the catalog or by link. The catalog
is a separate decision about showing the widget to everyone.

| | **In the catalog** | **By link only** |
| --- | --- | --- |
| Who finds it | everyone, in the Nest catalog | only people with your link |
| Version review | the same | the same |
| How to get there | the first version — a moderator approves it with the listing; later — a request a moderator decides | choose it at release or under **Access**; a moderator is needed only to approve the version |
| Install link | works | works |
| Installed copies | update | see below |

A moderator may approve a version and not take the widget into the catalog — the reason then arrives
in **Notifications**, and the widget stays installable by link. Leaving the catalog needs no
moderator: installed copies keep working and updating. A widget that was in the catalog and went
**By link only** keeps updating for everyone who installed it. While a widget has never been in the
catalog, people who installed it by link learn of a new version when they open the link again: send
it out again — it installs the latest approved version.

Take the catalog for a widget many people need. Take a link for a widget for your own people — a
team, students, clients — and for the first versions, while you break the widget in.

## <a id="policies"></a>Policies

- [policies/CONTENT.en.md](../policies/CONTENT.en.md) — what may be published in Nest, and why
  asking for a permission you do not need is a bad idea. Read it before your first version.
- [policies/TAKEDOWN.en.md](../policies/TAKEDOWN.en.md) — how Nest takes a widget down or revokes a
  version, and what users see then.
- [CHECKS.en.md](../CHECKS.en.md) — every refusal code: what it means, why it works that way and
  what to fix.
