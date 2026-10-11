# A Colibri widget — plain

One HTML page, no build and no Node.js: pick a venue and a coin, see the live bid, ask and last
trade. The choice is kept in `storage` and survives a restart.

> Русская версия — [README.md](README.md), она же основная.

## Where this project comes from

The terminal creates it: **Nest → Author → a widget → Code → From a template → Plain**. It writes
the widget's ID into `widget/widget.json` and loads the **`widget/`** folder with hot reload. Took
the folder from GitHub by hand? Write the ID yourself and link `widget/` through Code → Project
folder.

## Editing

The whole widget is `widget/index.html`. Save it and the terminal reloads the widget. The API's
types sit beside it in `widget/colibri.d.ts`, and VS Code reads them even in plain JavaScript.

| Path | What it is |
|---|---|
| `widget/index.html` | the widget itself |
| `widget/widget.json` | the manifest: ID, version, permissions |
| `widget/colibri.js`, `colibri.d.ts` | the SDK and its types — a copy of this repository's `sdk/` |

The terminal loads only `widget/`, so the READMEs and `.git` in the project root never get in the way.
