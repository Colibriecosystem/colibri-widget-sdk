# Taking a widget down

What happens when a widget is pulled — and what does not.

> Русская версия: [TAKEDOWN.md](TAKEDOWN.md)

---

## Three different actions

They are easy to confuse and they differ a great deal — and only the first reaches people who
already installed it.

| Action | What it does | What it does NOT do |
|---|---|---|
| **Revoke** | The widget joins the revocation feed. Terminals that read it **disable** the widget and show the reason; it can no longer start. | Deletes nothing, and **does not touch your own switch** — that is your intent, and the app does not overwrite it. |
| **Delist** | Removes it from the catalog: new users cannot find or install it. | Existing installs keep running, none the wiser. |
| **Delete** | Removes the listing and the archive from the registry. | For existing installs, the same as delisting — plus it breaks the archive URL, so this is cleanup AFTER a takedown, not the takedown. |

Revoking is the only one with a safety meaning, it is reversible, and it tells the user what
happened.

## How it reaches people

The terminal **polls** the feed: at start, every six hours, and when the user opens Nest. There is
no push channel and no remote kill switch.

Stated honestly, that means:

- a machine with no connection learns nothing until it has one;
- a widget running right now keeps running until its next poll or a restart;
- the usual delay is hours, not minutes.

We do not promise to switch something off everywhere within a second, because that would not be
true.

## A reason is required

A widget cannot be revoked without one — not as paperwork, but because the reason IS the entire
content of the card the user sees in the widget's place. A widget that simply vanished reads as the
terminal breaking.

Reasons are written in both languages and say what the widget did, not which rule it broke.

## If you are the one taken down

- We write to the author, unless the takedown was their own request.
- **Nothing is deleted**: the archive, the permissions and the widget's data stay on users'
  machines. Lift the revocation and the widget starts again in exactly the state the user chose.
- If you think it is a mistake, say so: un-revoking is one action, and it reaches users through the
  same poll.

## Revoking one version

A revocation can name a single version rather than the whole widget. A bad update is then switched
off while the previous good version keeps working for anyone still on it — and a user who updates
to a version the feed does not name heals on their own.

---

## See also

- [CONTENT.en.md](CONTENT.en.md) — what may be published.
- [AUTHORING.en.md](../AUTHORING.en.md) — the author's three stages.
