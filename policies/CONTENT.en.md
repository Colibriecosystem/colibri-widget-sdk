# What may be published in Nest

The rules are short, because people enforce them rather than a regulation. There is one point: a
user should understand what they are installing, and should not lose money to something they did
not expect.

> Русская версия: [CONTENT.md](CONTENT.md)

---

## Widgets can trade. And they can lose you money

This is the thing to say plainly. A widget holding the `trading` permission sends real orders from a
real account. There is no sandbox between it and the exchange — only the permission you granted once
at install, and the limits you set.

Two consequences follow, and both are unpleasant:

- **A bug in a widget is your money, not an error message.** A runaway loop, a swapped side or size,
  an unhandled exchange refusal — they all look the same from here: a position you did not open.
- **The registry's checks do not read logic.** We verify that the declared permissions match the
  code, that the archive was not tampered with, and that the network goes only where declared. We
  do **not** verify that a strategy is sound, that a size calculation is right, or that the author
  did not make a mistake.

Install a trading widget the way you would hand someone your account keys: only if you know who
wrote it and why.

---

## What we do not publish

- **Anything pretending to be something else.** The name, description and category must describe
  what the widget does. Hidden functionality is grounds for revocation, even when it is covered by a
  declared permission.
- **Data collection with no reason.** An events-calendar widget has no business reading balances. A
  permission that is not needed for the stated job is a reason to refuse.
- **Sending credentials or keys anywhere.** No network destination justifies exporting something
  that grants account access.
- **Code hidden from review.** Obfuscation for its own sake, loading code at runtime, `eval` over
  something fetched from the network. We check what is in the archive; if something else executes,
  the check means nothing.
- **Someone else's work without permission.** Brands, paid data, code under a licence that forbids
  it.

## What we ask for but do not require

- A description in both languages. The terminal's interface is Russian and English; a card in one
  language looks half-broken.
- Honest tags. Tags are yours, shown verbatim, and people search with them — junk in there hurts you
  first.
- A link to the source. Not required, and never will be — but an open-source widget earns trust
  faster, and it is the only way to show there is nothing to hide.

---

## Permissions: one rule

**Ask for what the widget cannot work without, and nothing else.**

The card shows permissions before installation, and users read them. A spare permission is not
"room to grow", it is a reason to close the card. Widening permissions in a new version asks for
consent again, so asking ahead buys nothing: you will be asking again anyway when you actually need
it.

Network destinations work the same way. `egress` is the list of hosts the widget may reach;
everything else is blocked. A widget with no network gets its own badge, and that is an advantage
rather than a limitation.

---

## See also

- [TAKEDOWN.en.md](TAKEDOWN.en.md) — how a widget is taken down, and what happens when it is.
- [AUTHORING.en.md](../AUTHORING.en.md) — the author's three stages.
