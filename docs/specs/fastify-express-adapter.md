# Tech Spec: Replace `@fastify/express` with an in-repo adapter
- **Author:** DJ Scruggs
  
- **Date:** 2026-06-02
  
- **Status:** Draft — for Engineering / DevOps / CTO / Privacy Officer review
  
- **Repo:** `@digitalbazaar/bedrock-express`
  
  
## 1. Problem
`@fastify/express` is a ~186-line connect-style adapter that runs our Express app as a fallback handler inside Fastify. It introduced two behaviors that fight Bedrock, forcing us to monkeypatch their monkeypatches:

1. **Eager URL decoding.** In `enhanceRequest`, upstream runs `decodeURI(url)` + `normalizeUrl(...)` and hands the _decoded_ URL to Express. This was a reaction to a reported "bypass" (URL-encoding a path to slip past a route guard). Encoding is not a security boundary; decoding the path eagerly corrupts encoded path parameters (a `%2F` inside a segment becomes a real `/`). We undo it by restoring `req.raw.url` from `originalUrl` (`lib/index.js:184`, `:208`).
  
2. **Unconditional** `headersSent` **property.** Upstream always runs `Object.defineProperty(reply.raw, 'headersSent', ...)`. The _mere presence_ of this property on `reply.raw` — even when `false`/`undefined` — derails any code that calls `Http2ServerResponse.writeHead` (Node http2 compat layer; webpack hot middleware). We delete the property when not truthy and re-implement `send`/`headersSent` to define it lazily (`lib/index.js:189-210`).
  

**Cost asymmetry.** Upstream is ~186 lines; our reactive hacks are ~65 lines (`lib/index.js:150-216`) and are inherently fragile: we capture their hooks via a fake `expressHook: 'captureHook'` name, intercept `addHook` and `decorate`, replay hooks conditionally, and re-implement `send`. Every upstream change forces a counter-patch. Team consensus: fork the needed behavior into a small, owned file.

**Usage scope.** `@fastify/express` is used only in `bedrock-express` (confirmed in thread). Removing it is contained to this repo.
## 2. Goals / Non-goals
**Goals**

- Remove the `@fastify/express` dependency.
  
- Remove the ~65 lines of counter-patching in `lib/index.js`.
  
- Own a single small adapter (`lib/express-adapter.js`, ~120 lines). {>>Renamed from `fastify-express.js` per c1 — generic name avoids implying we still depend on `@fastify/express`. The file adapts Express middleware to run inside Fastify.<<}{id="c1" by="user" at="2026-06-02T14:23:12.635Z"}{#c2 re="c1"}
  
- Preserve current external behavior of `bedrock-express` (events, config, middleware API, http2 support).
  

**Non-goals**

- No change to the Bedrock event API (`bedrock-express.configure.*`, `*.init`, `*.ready`, etc.).
  
- No change to `config.express.*`.
  
- No migration of Express middleware to native Fastify.
  
- No HTTP/2 redesign — existing `_addHttp2Support` / `expressHttp2` logic stays; it is ours, not upstream's.
  
## 3. Design
`bedrock-express` already builds one root Express `app` (`lib/index.js:54`) and wires all middleware onto it the normal Express way (`app.use(...)` for morgan, static, cors, body-parser, session, routes, error handlers). The only thing missing is a way to run that `app` inside Fastify's request lifecycle, because Fastify owns the server and listening (via `serverFactory`).

So the adapter has exactly one responsibility: **mount the existing Express** `app` **as the handler for any request that no Fastify route claimed.** It does not collect middleware, decorate `fastify.use`, or expose any registry — those were artifacts of `@fastify/express`, not things Bedrock needs.

New file `lib/express-adapter.js` exposing one helper:

```js
register(fastify, {expressApp})
```

`register` adds two Fastify hooks and nothing else. {>>c2: reframed — no `fastify.use`, no middleware accumulation, no encapsulation. The adapter just mounts the existing root `app`. The single internal caller (`lib/index.js:375 fastify.use(app)`) is replaced by the adapter mounting `expressApp` directly.<<}{id="c2" by="user" at="2026-06-02T14:38:53.324Z"}{#c3 re="c2"}
### 3.1 `onRequest` hook — make `req.raw`/`reply.raw` Express-compatible
For each request, augment the raw Node req/res so Express middleware works, **without mangling the URL**:

- set `req.raw.originalUrl = req.raw.url` (leave `url` untouched — no `decodeURI`, no normalize) **(decided: pass URL through untouched)**
  
- set `req.raw.id`, `hostname`, `ip`, `ips`, `log`; `reply.raw.log`
  
- define `req.raw.protocol` getter delegating to `req.protocol`
  
- copy `req.body` → `req.raw.body` (body-parser compat) when present
  
- copy `req.cookies` → `req.raw.cookies` (cookie-parser compat) when present
  
- wrap `reply.raw.send` only to guard against double-send (no URL restore needed because we never decoded it)
  
- **never** define `headersSent` on `reply.raw`
  
### 3.2 `onRequest` hook — run the Express `app` as the fallback
When no Fastify route matched (`req.routeOptions.url === undefined`, the existing gate), copy any headers Fastify has set onto `reply.raw`, then invoke the Express app: `expressApp(req.raw, reply.raw, next)`. Otherwise call `next()` and let Fastify handle the route.

This single root app handles everything; there is no per-instance/encapsulated app (decided: single root app only).
### 3.3 What we deliberately drop from the old approach
For reviewers familiar with `@fastify/express`, the behaviors we are **not** carrying over and why:

- `decodeURI(url)` + `normalizeUrl(url)` — corrupts encoded path params; encoding is not a security boundary. **Dropped.**
  
- always `defineProperty(reply.raw, 'headersSent')` — its mere presence aborts http2 `writeHead` callers. **Dropped.**
  
- `fastify.use` decoration + `kMiddlewares` registry + `onRegister` per-instance express — unnecessary indirection; we mount the one root app directly. **Dropped.**
  

What we keep (because Express middleware genuinely needs it): `originalUrl`, `id`, `hostname`, `ip`, `ips`, `log`, `protocol`, `body`/`cookies` copy, the double-send guard, and copying Fastify-set headers before invoking the app.
## 4. Changes to `lib/index.js`
**Remove** (~65 lines):

- `addHook` interception + `capturedHooks` (`:150-161`)
  
- `decorate` interception forcing local express (`:163-171`)
  
- `await fastify.register(fastifyExpress, {expressHook: 'captureHook'})` (`:172`)
  
- captured-hook replay loop incl. URL restore + `headersSent` dance (`:176-216`)
  
- `import fastifyExpress from '@fastify/express'` (`:27`)
  
- `fastify.use(app)` mount (`:375`) — the adapter mounts `app` itself now
  

**Replace with:**

```js
import {register as registerExpressAdapter} from './express-adapter.js';
// ...
// mounts `app` as the fallback handler; replaces both the
// `@fastify/express` register call and the later `fastify.use(app)`
await registerExpressAdapter(fastify, {expressApp: app});
```

`fastify.use` is no longer exposed. Its only caller was the internal `fastify.use(app)` mount; downstream modules use the documented event API, not `fastify.use`. Removal is noted in the CHANGELOG (see §5).

**Keep unchanged:**

- `expressHttp2` onRequest hook (`:112-148`) — our http2 augmentation
  
- `_addHttp2Support`, `_customExpressInit`, `_createAppWrapper` — ours
  
- everything from `bedrock-express.fastify.init` onward
  
## 5. Dependency / packaging changes
- `package.json`: remove `@fastify/express` from `dependencies`.
  
- Keep `fastify` and `express` direct deps.
  
- Bump version per DB release flow (minor or patch — TBD with reviewer; behavior is intended to be unchanged so patch may be appropriate).
  
- `CHANGELOG.md`: note removal of `@fastify/express`, removal of the undocumented `fastify.use` method, and that the URL-decode fix and `headersSent` fix collapse into the in-repo adapter.
  
## 6. Test plan (Red/Green, `test/`)
Write failing tests first, then implement.

1. **Encoded path parameter** (the core regression): route `/foo/:id`, request `/foo/a%2Fb` → `req.params.id === 'a/b'` and `req.url` remains encoded. RED against any adapter that decodes.
  
2. **Double-encoding** — confirm no decode-based "bypass" is reintroduced; the app sees exactly what the client sent.
  
3. **http2 +** `writeHead` — a handler path that triggers `writeHead` must not abort (the `headersSent` presence regression).
  
4. **Double-**`send` **guard** — calling `res.send()` twice is a no-op, no throw.
  
5. **Express middleware compat** — body-parser (`req.body`), cookie-parser (`req.cookies`), and `protocol`/`ip` are populated on `req.raw`.
  
6. **Fallback gating** — a defined Fastify route takes precedence; Express only runs when `req.routeOptions.url === undefined`.
  
7. Existing `test/test.js` suite stays green.
  

CI runs lint (Node 22) + tests (matrix 22/24/26). Tests require nvm Node, so they are run locally with `npm test` before PR.
## 7. Security & privacy review
- **Attack surface:** _reduced._ We drop a transitive monkeypatch chain and own ~120 reviewable lines. No new network surface, no new data handling.
  
- **The "bypass" concern:** Not reintroduced. Passing the URL through unchanged means route guards see exactly what the client sent; encoding is not treated as a security boundary (correct). Route authorization remains the responsibility of downstream guards, unchanged from today's _effective_ behavior (we already restore the original URL).
  
- **Personal data:** none collected, stored, or transmitted by this change. `ip` / `hostname` are already surfaced on `req` by Express/Fastify today; behavior is unchanged.
  
- **Error handling:** no change to error responses or logging; no stack traces added to responses.
  
- **Misuse:** the adapter only runs the configured Express app as a fallback; no new externally controllable behavior.
  
## 8. Rollback
Pure code change, no data migration. Rollback = revert the commit and restore the `@fastify/express` dependency. Pin restored to the last-known-good version if needed.
## 9. Open questions
1. **Version bump:** patch (behavior intended unchanged) or minor (dependency removed)? Need reviewer call.
  
2. `normalizeUrl` **parity:** upstream optionally collapses duplicate slashes / handles a semicolon delimiter. Decided to pass URL through untouched — do any Bedrock apps rely on duplicate-slash collapsing today? If yes, we add a minimal opt-in.
  
3. `createProxyHandler` **option:** upstream supports a custom Proxy handler on `req.raw`. Is any downstream module using it via `@fastify/express` directly? (Assumed no, since only `bedrock-express` consumes the dep.)
  
4. **HTTP/2 fallback path:** confirm the new adapter's connect-runner composes correctly with the existing `expressHttp2` hook ordering (adapter hook must run after `expressHttp2`).
