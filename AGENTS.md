# AGENTS.md

Guidance for AI agents working in this repository.

> This file currently covers two conventions. It is **not** a complete description of this
> repository's conventions — read the README and the code around whatever you are changing.

## UI mockups live in a different repository

**Never add a design mockup to this repository.** Mockups — static HTML pages we look at and comment
on before something is built — are authored in the public repo `Colibriecosystem/colibri-mockups`
and published at <https://colibriecosystem.github.io/colibri-mockups/>.

A mockup exists to be opened by other people and commented on, so it needs a permanent URL, and
GitHub Pages on this organisation's plan publishes from a public repository only — a private repo
cannot host one at all. Same rule, same reason, as the SDK and the connect page: a public-facing
artefact is authored in its public repo.

Three rules that follow, each easy to get wrong:

- **Scrub before publishing.** No issue numbers, no private repo names, no source paths, no internal
  ticket references. A mockup is a public page and the roadmap it hints at is visible to anyone with
  the link.
- **Vendor only what the page uses.** Before copying a file out of a private repo into the public mockups repo, read what else it carries. A design-system string table, for instance, usually holds the admin console's vocabulary alongside the handful of strings a page actually needs; vendor the handful, not the file.
- **Links to individual mockups live on that repo's front page only.** Anywhere else — here, a doc,
  an issue — link the site root, so there is exactly one place to update when a mockup is added or
  renamed.

## Every release of this repository is a starters release

Terminals create a widget project from the starters in [`starters/`](starters/): they read
`https://github.com/Colibriecosystem/colibri-widget-sdk/releases/latest/download/starters.json` and
download each zip from the release that index names. So **the release marked "latest" must always
be a starters release** — one published by `.github/workflows/starters.yml` from a `starters-*` tag,
carrying `starters.json` and every `starter-*.zip`. Never publish another kind of release here and
never mark one "latest" by hand: every terminal's «Из шаблона» would break at once.

- To ship a change to a starter (or to the SDK copies inside them), merge it and push a new
  `starters-X.Y.Z` tag. The workflow builds, packs, publishes as a draft, then marks it latest and
  downloads it back to check every hash.
- `starters.json`'s format only grows (new optional fields). A breaking change publishes
  `starters.v2.json` beside it, and `starters.json` keeps being published for older terminals —
  see [`starters/README.md`](starters/README.md).
