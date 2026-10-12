# Your first widget: from a template to the catalog

> Русская версия — [getting-started.md](getting-started.md).

In about half an hour you walk the whole author's path: create a widget from the **Plain** template,
edit it with hot reload, release version 1.0.0 by link, and with the next version ask for a place in
the Nest catalog. No Node.js and no build: the template is one HTML page.

Every step says where to click and what you should see. Each screen of the **Author** tab is
described in detail in [publishing.en.md](publishing.en.md).

## <a id="before-you-start"></a>Before you start

- **A Colibri with templates.** On the Nest window's **Author** tab, a widget's **Code** section
  must have a **From a template** card. If it has none, update the terminal.
- **A text editor.** Any will do. VS Code completes the API from its types: `colibri.d.ts` sits next
  to the widget's code.
- **Internet access.** The terminal downloads the template from this repository's release on GitHub
  and sends versions to Nest.
- **20–30 minutes.** This path needs no Node.js.

## <a id="become-author"></a>1. Become an author

Click **Nest** in the terminal's top bar and open the **Author** tab. On the left is the
**How publishing works** card: five steps, and this page follows them too. On the right is the
**Become an author** form.

There is no sign-in and no password. Nest issues an **author key**: it is your identity in Nest, and
it belongs to this computer.

1. **Display name** — every widget of yours is signed with it. Required.
2. **Email** — required too, but only Nest moderators see it: it is how they reach you about your
   widgets.
3. **YouTube channel**, **Telegram channel**, **Telegram for contact** and **Source code link** are
   optional and can be filled in later.
4. Click **Become an author**.

The tab turns into the author's workspace, and an **Author key on this computer** card appears at
the top. Nest shows the key once: click **Copy** and keep it in a password manager. Whoever holds
the key can publish as you, so treat it like a password. Click **Set up recovery** right away as
well: a recovery code gives you access back if this computer is lost. Then click **I saved it**.

The author profile and what it shows: [publishing.en.md#author](publishing.en.md#author). Working
from another computer and recovering the key:
[publishing.en.md#author-key](publishing.en.md#author-key).

## <a id="new-widget"></a>2. Create the widget

In the author bar at the top, click **New widget**. The dialog asks only for a **Name** — say, "My
spread". You can enter the category and a description here too, under **Fill in now (optional)**, or
later in the listing. Click **Create**.

The widget's page opens, with the **Overview**, **Versions**, **Listing**, **Code**, **Access** and
**Stats** sections. Next to **ID** it reads **set once its code is linked**: a widget's ID is the
`id` field in its `widget.json`, and a draft takes it from the code you link to it. In this tutorial
the template writes the ID in. The ID rules are in
[publishing.en.md#widget-id](publishing.en.md#widget-id).

On the **Overview** section the **WHAT NEXT** card already says what to do:
**Link it to your code**, with a **Link the code** button.

## <a id="code"></a>3. Code: three ways

Open the **Code** section. It has three cards — three ways to give the widget its code. Versions are
later released from whatever is linked here.

**Project folder** — a folder with a `widget.json`, one you made yourself or took from the SDK. The
draft takes its ID from that `widget.json`, and the terminal serves the folder in place, with hot
reload. More [below](#own-folder).

**From a template** — the terminal creates a project from one of the SDK's four templates, writes
the widget's ID into it and runs it at once. That is the next step of this tutorial.

**A website (hosted)** — for a web app that already runs over https: the terminal builds the
manifest itself, and the code stays on your server. More [below](#hosted).

## <a id="from-template"></a>4. A project from the plain template

1. On the **From a template** card, click **Choose a template…**. **A new project from a template**
   opens, and the terminal loads the list of templates from the SDK's latest release.
2. Pick **Plain** — the tile marked **no build**.
3. In the **ID** field the terminal suggests an ID from the name, in Latin letters. Change it if you
   like, say to `my-spread`: lowercase Latin letters, digits and hyphens, up to 40 characters. Until
   the widget has a version, the ID can still change.
4. **Create in** is the parent folder; by default `ColibriWidgets` in your user folder. **Change…**
   picks another. Under the field you see where the project will go: `<folder>\<ID>`.
5. Click **Create project**.

Under the button you see what the terminal does: it downloads the template and checks its SHA-256
against the release, writes the ID into every `widget.json` of the project, gives the draft that ID
in Nest, and loads the `widget/` folder with hot reload. How the templates work:
[starters/README.en.md](../starters/README.en.md).

The terminal loads the `widget/` subfolder, not the project root: it hashes everything it loads and
packs it into a version, and the README and `.git` in the root are no use to the widget.

If the list of templates does not load, check your network or proxy and click **Try again**. Or
download the template with **Templates on GitHub**, write the ID into `widget/widget.json` yourself
and link the `widget/` folder as [your own folder](#own-folder).

## <a id="first-run"></a>5. The first run

Right after the project is created, the terminal asks for permissions — the same question every user
gets at install. The dialog lists what the widget asks for: market data and its own storage
(`marketData` and `storage` in `widget.json`). Click **Allow**.

What you see:

- **The widget's window.** The template declares the `window` surface, so the terminal opens the new
  project in a window of its own: a venue picker, a coin field with `BTCUSDT`, and the live bid, ask
  and last trade. Closed the window? The **Code** section has **Open in a window**.
- **Code.** The **Code** section shows the **Linked folder** with the path to `…\my-spread\widget`
  and the **Hot reload** switch on; next to **ID** in the header it says `my-spread`. Above the page
  a line says the project was created and already runs.
- **The widget list.** In Nest → **My widgets** the same widget carries a **DEV** mark: it is your
  folder, not an install from Nest.

To put the widget into your layout, click 🧩 in the top right corner of an empty box (the tooltip
reads **Place a widget in this box**) and pick your widget.

## <a id="hot-reload"></a>6. Edit with hot reload

Open `widget/index.html` in your editor: **Open the folder** on the **Code** section opens the
`widget/` folder. The whole widget is this one file. Let's add the spread — the gap between the best
ask and the best bid.

1. In the `<div class="quote">` block, after the last-trade row, add a spread row:

   ```html
   <span class="label">Spread</span><span id="spread">—</span>
   ```

2. In the `follow()` function, replace the `stops` array as a whole. Its first subscription is to
   the `book` channel; on top of painting the bid and the ask, it now paints the spread:

   <!-- check: prelude const exchange = "BinanceSpot"; const symbol = "BTCUSDT"; let stops = []; const $ = (id) => document.getElementById(id); function paintBook(book) {} -->
   ```js
   stops = [
     stream.subscribe("book", { exchange, symbol, depth: 1, hz: 4 }, (book) => {
       paintBook(book);
       // Prices arrive as decimal strings: compute the spread in numbers, round it to the tick size.
       const digits = (book.tickSize.split(".")[1] ?? "").length;
       const spread = Number(book.bestAsk) - Number(book.bestBid);
       $("spread").textContent = book.bestBid && book.bestAsk ? spread.toFixed(digits) : "—";
     }),
     stream.subscribe("trades", { exchange, symbol }, (frame) => {
       const print = frame.trades[frame.trades.length - 1];
       if (!print) return;
       $("last").textContent = print.price;
       $("last").className = print.isBuy ? "buy" : "sell";
     }),
   ];
   ```

3. Save the file. Within half a second to a second the widget reloads by itself, and the spread
   shows under the last trade.

Do not add a second subscription to the same book: a channel has one subscription per venue and
coin, and a handler receives every snapshot of its channel. Inside the handler, `book` is typed as
`Book` from `colibri.d.ts`, so VS Code completes its fields. A reload opens the page afresh:
whatever was in memory is gone, while the template keeps the chosen market in `storage` and restores
it.

If the spread does not show, open the widget's DevTools — Chromium's console, network and elements,
as in a browser:

- in the widget's window — ⚙ (**Widget menu**) → **DevTools**;
- in a box — ⚙ in the widget's header → **DevTools**;
- in Nest → **My widgets** → ⋯ on the widget's row → **DevTools**.

You can turn hot reload off with the **Hot reload** switch on the **Code** section and reload the
widget by hand with **Reload** beside it.

## <a id="permissions"></a>7. Permissions

`permissions` in `widget.json` is what the terminal asks the user to agree to. Add one, and after
you save, the widget stops on a **Permissions needed** card: click **Permissions…** and agree again.
Users get the same: a version with a new permission asks every one of them again on update, and Nest
always sends such a version to a moderator.

Ask for the minimum. Every line in the consent dialog is a reason not to install the widget, and a
permission it does not need is a reason to decline the version. The plain template needs only
`marketData` and `storage`; this tutorial adds nothing. Every permission and what it opens:
[reference/README.en.md#permissions](reference/README.en.md#permissions).

## <a id="listing"></a>8. The listing

The listing is how the widget looks in the catalog and on its own page in Nest. Open **Overview**:
the **Ready for the first version** card has five required items — **Name**, **Icon**, **Category**,
**Description (EN or RU)** and **Code linked**. The name and the code are done. The rest is on the
**Listing** section:

1. **Icon** → **Choose icon…**. PNG, JPEG, WebP, GIF, BMP or ICO up to 512 KB, each side 32 to 1024
   px; a 128×128 square on a transparent background works best. SVG is not accepted. The icon is
   saved at once.
2. **Category** — say, **Market data**.
3. **Description (RU)** and **Description (EN)** — the short line in the catalog, up to 400
   characters. At least one is required.
4. Click **Save**.

On the right, under **In the catalog**, the catalog row changes as you type. On the **Overview**
section readiness becomes 5 / 5, and the **WHAT NEXT** card says **Ready for the first version**.
Items marked **recommended** — a long description, screenshots, links — never hold a release back.
Every listing field: [publishing.en.md#listing](publishing.en.md#listing).

## <a id="first-release"></a>9. The first version, by link only

In this tutorial version 1.0.0 goes out by link only: a tutorial widget has no place in the public
catalog, and you ask for the catalog with the next version.

Click **Release the first version** in the page header. The release wizard opens, in four steps:

1. **1 · Number**. The template's `widget.json` already says `1.0.0`, and the wizard offers exactly
   that — **as in widget.json**. Click **Next**.
2. **2 · What's new**. Optional for a first version. For example, in **What's new — English**: "Bid,
   ask, last trade and the spread", and the same in Russian under **What's new — Russian**.
3. **3 · Archive**. After **Packing the folder…** the wizard shows the number marked
   **written into widget.json**, the archive's **Size** and **SHA-256**, and under
   **What changes for users** that a moderator reviews the first version together with the listing.
   The whole `widget/` folder goes into the archive.
4. **4 · Send**. Under **Where to offer it**, choose **By link only** and click **Send for review**.

The wizard closes on the **Versions** section. The 1.0.0 row first reads **Being checked** — Nest
checks the archive automatically, usually in a minute or two. Then **In review**: a moderator looks
at the version and the listing, and the row says by when they usually answer. The decision arrives
in **Notifications** (the bell in the author bar), and the row becomes **Current**.

If something is wrong:

- **Refused by checks** — the archive failed an automatic check. Expand the row: it shows the stage,
  what to fix and **About this rule**. The version was not stored, so once fixed you can send 1.0.0
  again.
- **Declined** — a moderator declined the version and said why. You can answer in the version's
  conversation; the fixed code goes out under the next number.

Every review stage and what each refusal means: [publishing.en.md#review](publishing.en.md#review).

## <a id="install-link"></a>10. The install link

Open **Access** → **Install link** and click **Copy** (or **Copy link** in the page header). The
link appears after the first upload and works as soon as the first version is approved.

Anyone who has the link can install the widget: in Nest → **My widgets** → **Add a local widget…**,
paste it into the field and click **Continue**. What follows is an ordinary install: the consent
dialog, a pinned hash, permissions revoked in one click. So give the link only to the people you
mean to.

## <a id="catalog"></a>11. Version 1.0.1, into the catalog

Fix something in `widget/index.html`, save and check it in the widget's window. Then click
**Release a version**:

1. **1 · Number** — the wizard offers **fix**, `1.0.1`, first. Numbers only grow: 1.0.0 is taken for
   good.
2. **2 · What's new** — now required in at least one language: users see it before they update.
3. **3 · Archive** — only the code changes, so users are not asked anything again.
4. **4 · Send** — **By link only** is marked **now**. Choose **In the catalog**: it is a request,
   and the moderator decides it together with version 1.0.1. Click **Send for review**.

The page header shows **Catalog requested**. The moderator may approve the version and take the
widget into the catalog — then everyone can find it, and the **Overview** section says "In the
catalog · version 1.0.1". Or they may approve the version but not take it into the catalog — then
the widget stays by link, and the reason arrives in **Notifications**. How the catalog differs from
a link: [publishing.en.md#catalog-or-link](publishing.en.md#catalog-or-link).

## <a id="other-paths"></a>Other ways to the code

### <a id="own-folder"></a>Your own folder

**Code** → **Project folder** → **Choose a folder…**. Any folder with a `widget.json` in it will do.
The smallest is two files, `widget.json` and `index.html`:

```json
{
  "id": "my-widget",
  "version": "1.0.0",
  "entry": "index.html",
  "surfaces": ["slot", "window"],
  "permissions": ["marketData"]
}
```

The draft takes its ID from that `widget.json`. A draft with no ID yet takes it at once; one that
has an ID but no version asks whether to change it — **Change the id** — and the old ID is freed. A
widget with a version keeps its ID: the folder must carry it, or the terminal says which one it
needs. A folder that belongs to another of your widgets cannot be linked. The same in one step:
**New widget** → **From a folder…** takes the name and the ID from `widget.json` and links the
folder as soon as the widget is created.

The terminal serves the folder in place — nothing is copied — and reloads the widget after every
save. It does not change your files on its own, with one exception: the release wizard writes the
version number into `widget.json`, and puts the old one back if you cancel. Link the folder that
holds the finished widget (`dist/`, if there is a build), not a project root with `node_modules`: a
version is limited to 2000 files and 50 MB.

### <a id="hosted"></a>A site that already runs

**Code** → **A website (hosted)** → **Enter the address**. Fill in **Address** (https://…), **ID**
(suggested from the name) and **Where it shows** — slot, window or both — then click **Link**. The
terminal builds the `widget.json` itself and opens your site as a widget.

The manifest starts minimal: no permission at all and only the site's own host. Open the widget and
go through its features — whatever the terminal refused the site shows up on the **Code** section
under **The site tried — and was refused**: **Add** one at a time or **Add all**. Anything else goes
under **Set by hand**.

The release wizard of such a widget has three steps and no archive. You update the site itself
without a release, and a moderator reviews every hosted version. When to choose hosted and when
bundled: [publishing.en.md#hosted](publishing.en.md#hosted).

### <a id="react"></a>The TypeScript and React template

In **A new project from a template**, pick **TypeScript + React** — the tile marked **Node.js**. The
terminal loads the template's ready `dist/` build, so the widget runs at once, without Node.js.

To edit the code you need Node.js 20 or newer. The **Code** section shows **Next: edit the sources**
— two commands to run in the project folder (**Open the project folder**):

```bash
npm install
npm run watch
```

`npm run watch` is `vite build --watch`: it rewrites `dist/` on every save, and the terminal reloads
the widget. Edit `src/App.tsx`; `npm run typecheck` checks the types. More in
[starters/react/README.en.md](../starters/react/README.en.md).

Prefer HMR? Run `npm run dev` (Vite on `localhost:5173`) and link the `dev/` folder instead of
`dist/` with **Link another folder…**. Its `widget.json` points `entry` at the dev server, which
only a linked development folder may do — see
[reference/manifest.en.md#dev-server-entry](reference/manifest.en.md#dev-server-entry). Such a
folder cannot be released: link `dist/` back before **Release a version**.

The release wizard packs the linked `dist/`. It writes the new number into `dist/widget.json`, and
also into `public/widget.json` and `dev/widget.json` so the next build keeps it — only into copies
that carry this widget's ID and still held the previous number. Cancel the release and the previous
number goes back into all three.

## <a id="next"></a>What next

- [recipes.en.md](recipes.en.md) — ready-made solutions: the order book, trades, positions, a safe
  order, the theme, the language, settings, outside data.
- [reference/README.en.md](reference/README.en.md) — the API reference: every call, channel and
  manifest field.
- [publishing.en.md](publishing.en.md) — every screen of the **Author** tab, review and moderation.
- [starters/README.en.md](../starters/README.en.md) — the four templates: plain, TypeScript + React,
  trading and chart.
- [CAPABILITIES.en.md](../CAPABILITIES.en.md) — what a widget can and cannot do, and how to pick an
  architecture.
- [CHECKS.en.md](../CHECKS.en.md) — every Nest refusal and what to do about it.
