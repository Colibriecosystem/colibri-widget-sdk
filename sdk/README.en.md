# @colibri-terminal/sdk

> Русская версия — [README.md](README.md).

The Colibri widget API client — two files, no build step and no dependencies:

| File | What it is |
| --- | --- |
| [`colibri.js`](colibri.js) | the client: a thin wrapper over `window.colibri`, which the terminal puts into the page before its code runs |
| [`colibri.d.ts`](colibri.d.ts) | the types: editor hints and TypeScript checking |

The package is not published to npm — its `package.json` is `private`. Put both files beside your
page and import them as a module; every [starter](../starters/) already carries a copy.

```html
<script type="module">
  import { handshake, markets, stream } from "./colibri.js";
</script>
```

A new SDK version means fresh copies of both files from this folder.

- Every call, channel and event: [the reference](../docs/reference/README.en.md); how the SDK differs
  from the bare `window.colibri` — [there too](../docs/reference/README.en.md#bridge-vs-sdk).
- Your first widget, step by step: [getting started](../docs/getting-started.en.md).
