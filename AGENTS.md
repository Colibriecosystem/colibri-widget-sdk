# AGENTS.md

Guidance for AI agents working in this repository.

> This file currently covers three conventions. It is **not** a complete description of this
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

## The author docs are pairs, checked against the code

Every page is a pair: `X.md` in Russian (the authored voice) and `X.en.md` in English, with the same
explicit ids, the same heading structure and the same code blocks. The API reference in
[`docs/reference/`](docs/reference/) documents every member of `sdk/colibri.d.ts` with its exact
declaration and the scope it needs, and every code sample compiles against the types. All of it is
enforced by `node scripts/docs.mjs check` and `snippets` (CI: `.github/workflows/docs.yml`).

- Add a member to the SDK and the check fails until the reference has it; `node scripts/docs.mjs
  scaffold` prints the missing sections.
- Released terminals link pages and anchors listed in
  [`scripts/published-ids.txt`](scripts/published-ids.txt). Those ids are forever: never remove one,
  and never rename a `CHECKS*.md` code heading or `CAPABILITIES*.md`'s browser-permissions heading.
- These pages are public: no private repository names, terminal source paths or private issue numbers.
