# Storage and network: storage and net

> Русская версия — [storage-and-net.md](storage-and-net.md).

`storage` is a durable key-value store the terminal keeps. `net.fetch` is a venue request the
terminal performs on the widget's behalf, when the page cannot make it itself.

## <a id="storage"></a>storage

Each widget instance has its own store: keys live in the `handshake().instanceId` namespace, and two
copies of the widget in two slots never see each other's keys. The data survives a page reload, a
terminal restart and a widget update, and is wiped when the widget is uninstalled.

- **The quota is 5 MB per widget**, across all its instances together. A write past it is refused
  with the code `quota_exceeded`, and the store stays exactly as it was before.
- **A key** is a non-empty string of up to 256 characters. **A value** is a string: save an object
  with `JSON.stringify`, read it with `JSON.parse`.
- **Errors** are a `ColibriError` with `status` 0 and the host's code: `unauthorized` — the widget
  lacks the `storage` scope, `bad_request` — an empty or too long key, `quota_exceeded`,
  `bridge_disabled` — the user switched the bridge off, `internal` — the disk write failed.

Prefer it to `localStorage`. `localStorage` is shared by all instances of the widget (a widget has
one origin), and the terminal does not answer for it: it is the browser's cache. It is fine for small
things, but not for anything the user would hate to set up again. The recipe is on
[recipes.en.md](../recipes.en.md#save-settings).

```js
import { storage } from "./colibri.js";

const defaults = { exchange: "BinanceSpot", symbol: "BTCUSDT" };
const saved = await storage.get("market");
const market = saved ? JSON.parse(saved) : defaults;

// The user picked another symbol — remember it.
market.symbol = "ETHUSDT";
await storage.set("market", JSON.stringify(market));
```

### <a id="storage-get"></a>`storage.get()`

```ts decl
get(key: string): Promise<string | null>;
```

Scope: `storage`.

The key's value, or `null` when this instance has no such key. On an instance's first run the store
is empty — keep your defaults in code.

### <a id="storage-set"></a>`storage.set()`

```ts decl
set(key: string, value: string): Promise<void>;
```

Scope: `storage`.

Write a value, replacing the old one. The quota is checked before the write: a `quota_exceeded`
refusal changes nothing, on disk or in memory. Do not write on every mouse move — write when the user
has finished changing things.

### <a id="storage-remove"></a>`storage.remove()`

```ts decl
remove(key: string): Promise<void>;
```

Scope: `storage`.

Delete a key. Deleting a key that does not exist is not an error.

### <a id="storage-keys"></a>`storage.keys()`

```ts decl
keys(): Promise<string[]>;
```

Scope: `storage`.

Every key of this instance — without any internal prefix, exactly as you wrote them. Other instances'
keys are not here.

### <a id="storage-clear"></a>`storage.clear()`

```ts decl
clear(): Promise<void>;
```

Scope: `storage`.

Delete every key of this instance. Other instances of the widget are untouched — for a "reset
settings" button, say.

## <a id="net"></a>net

Your widget owns its market data ([why](market-data.en.md#market-data-sources)), and venue WebSockets
work straight from the page. REST is different: many venues send no CORS headers at all (KuCoin and
Kraken Futures among them), and no page-side code gets around that. `net.fetch` is the way through:
the terminal performs the request, so CORS never enters into it.

### <a id="net-fetch"></a>`net.fetch()`

```ts decl
fetch(url: string, init?: { method?: "GET" | "POST"; body?: string; contentType?: string }): Promise<NetFetchResult>;
```

Scope: `egress`.

This is not a scope from `permissions` but your manifest's [`egress`](manifest.en.md#manifest-egress)
list plus the user's consent: the host must be **both** declared in the current version's manifest
**and** granted by the user. A host you dropped from the manifest is unreachable, even if the user
once granted it.

The rules people trip on most:

- **`https` only, GET and POST only.** The URL is absolute; a user name and password in it are
  refused.
- **A host not in `egress`** is `egress_denied`. An entry without a port covers any port, one with a
  port covers only that port; `*.example.com` covers subdomains but not `example.com` itself.
- **Redirects are never followed**: a 3xx comes back to you as it is. An allowlist that checks only
  the first hop allows nothing.
- **The cap is 60 requests a minute per instance**, then `rate_limited`. A request body is up to
  256 KB, a response up to 8 MB (`net_too_large`), the wait up to 15 seconds (`net_timeout`). A network
  failure is `net_failed`.
- **The response body is TEXT.** The terminal does not parse the venue's reply: `JSON.parse` is
  yours. A `body` sent without a `contentType` goes out as `application/json`.
- No cookies are sent; the request leaves the machine the same way the page's own traffic does.

The call does not throw for any of these: it resolves a [`NetFetchResult`](#types) with `ok: false`
and the reason in `code`. `ok: true` means the venue answered — possibly with an error, so check
`status`. A switched-off bridge is `ok: false` with `bridge_disabled`.

WebSockets do not need `net.fetch`: open them from the page. The terminal serves your document with a
`Content-Security-Policy: connect-src` built from `'self'` and every `egress` host (as `https://` and
`wss://`), so a socket to an undeclared host throws a `SecurityError` at construction. The ready
recipe is on [recipes.en.md](../recipes.en.md#outside-data).

```js
import { net } from "./colibri.js";

const r = await net.fetch("https://api.kucoin.com/api/v1/market/allTickers");
if (!r.ok) throw new Error(`the terminal did not perform the request: ${r.code}`);
if (r.status !== 200) throw new Error(`the venue answered ${r.status}`);
const tickers = JSON.parse(r.body).data.ticker;

const p = await net.fetch("https://api.example-venue.com/v1/quote", {
  method: "POST",
  body: JSON.stringify({ symbols: ["BTCUSDT"] }),
});
```

## <a id="types"></a>Types

```ts decl
/** The answer to a net.fetch. ok: false — the request never reached the venue, or its reply was refused. */
interface NetFetchResult {
  ok: boolean;
  /** The venue's HTTP status, or 0 when the call never got that far. */
  status: number;
  /** The response TEXT — the host does not parse a venue's payload for you. */
  body: string | null;
  contentType?: string;
  /** egress_denied | rate_limited | net_failed | net_timeout | net_too_large | bad_request. */
  code?: string;
  message?: string;
}
```
