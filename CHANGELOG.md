# bedrock-express ChangeLog

## 8.1.0 -

### Changed
- Allow json `req.body`s that are not Arrays or Objects.

## 8.0.0 - 2022-04-28

### Changed
- **BREAKING**: Update peer deps:
  - `@bedrock/core@6`
  - `@bedrock/server@5`.
- Use renamed `fastify-express` (new name: `@fastify/express`).
- **BREAKING**: `config.express.staticOptions.maxAge` is now computed from
  `config.express.cache.maxAge` by default.

## 7.0.1 - 2022-04-01

### Fixed
- Use `jsdoc-to-markdown@7`.

## 7.0.0 - 2022-04-01

### Changed
- **BREAKING**: Rename package to `@bedrock/express`.
- **BREAKING**: Convert to module (ESM).
- **BREAKING**: Remove default export.
- **BREAKING**: Require node 14.x.

## 6.4.1 - 2022-03-24

### Fixed
- Fix remaining non-ESM internals.

## 6.4.0 - 2022-03-24

### Changed
- Update peer deps:
  - `bedrock@4.5`
  - `bedrock-server@3.2`.
- Update internals to use esm style and use `esm.js` to
  transpile to CommonJS.

## 6.3.0 - 2022-01-21

### Added
- Add tests and expose private test helper functions in API.

## 6.2.2 - 2022-01-16

### Fixed
- Only set Private Network Access header on preflight request.

## 6.2.1 - 2022-01-16

### Fixed
- Add patch to ensure current CORS behavior continues for bedrock-express
  servers running on localhost. This is mostly for development purposes,
  but does apply to any bedrock-express server that actually does run
  in production on localhost. The new [Private Network
  Access](https://wicg.github.io/private-network-access/) CORS security
  feature has been added to Chrome to stop cross-origin requests from
  being made to private networks (without specific permission via a new
  CORS header). The header is:

  `Access-Control-Allow-Private-Network: true`

  This change enables sending that header on every response -- if the
  bedrock server's host is configured such that the string `localhost`
  appears in its value. This alone will not enable CORS on an endpoint,
  the `Access-Control-Allow-Origin` header must also be set. This
  header is only set if the `cors` middleware has been used (or some
  other means has been used) on a specific route. Therefore, this change
  should not expose any routes that were not previously exposed via
  CORS headers, rather, it should only enable any routes that were
  previously exposed to continue to be hit just like before, provided
  that they are running on localhost. If the server runs on some other
  private network, the new version of Chrome will not allow them to be
  accessed even if the other CORS headers have been set, because this
  patch will not set the new header in that case. If this feature needs
  to be disabled, set `bedrock.config.express.allowLocalhostCors=false`.

## 6.2.0 - 2022-01-11

### Changed
- Add automatic fix for calling `next` from an `asyncHandler`. In previous
  versions `process.nextTick(next)` was required to safely call a subsequent
  middleware from a middleware created with `asyncHandler`. It is still
  safe to keep doing that, however, now it is also safe to just call `next()`
  normally because this behavior is built into the `asyncHandler` helper.

## 6.1.0 - 2021-10-26

### Added
- Add `fastifyOptions` to the Bedrock config.

## 6.0.0 - 2021-10-07

### Changed
- **BREAKING**: Set default value for `dumpExceptions` to `false`. This prevents
  unwanted stack traces from being included with HTML error responses.

## 5.0.1 - 2021-08-25

### Fixed
- Fixed bug when http/1.1 is used. Outgoing messages would not be flushed
  when using an augmented response object instead of one where the prototype
  was set to express's response object (which is the default express behavior).
  The previous version of the code attempted to avoid this prototype overriding
  in all cases (http/2 and http/1.1), but only the http/2 version functions
  properly. Until the root of the problem is sorted out with http/1.1, this
  patch restores the prototype overriding method for http/1.1 requests.

## 5.0.0 - 2021-08-24

### Added
- Add `bedrock-express.fastify.init` event to allow modules to listen to when
  `fastify` has been initialized. No events are currently emitted for adding
  routes/middleware/etc. to `fastify` as no pattern for this has been yet
  determined. For now, the events for adding routes via express should
  continue to be used.
- Add `bedrock-express.fastify.ready` event when the express app is ready and
  has been added to `fastify`.
- Expose `fastify` instance and `Fastify` class via module API.
- A new option, `config.express.session.ttl`, used by session storage libraries.
- Updated the Configuration section of the README with ttl options.

### Changed
- Update underlying engine to use fastify with an express compatibility layer.
  This approach is intended to allow node's native `http2` implementation to be
  used and provides a pathway to upgrading to fastify and deprecating express.
- **BREAKING**: Change bedrock-server peer dependency to 3.x. This is not a hard
  requirement; bedrock-server 2.x should work with this change, however, a
  new major revision avoids having to support 2.x.
- **BREAKING**: `config.express.session.saveUninitialized` now defaults to
  false. Unmodified sessions will no longer save to the database until data has
  been added to the session.
- **BREAKING**: The Fastify `trustProxy` option is disabled by default. This
  option is used when a Bedrock application is running with `httpOnly = true`
  behind a load balancer that is doing TLS termination. The ability to enable
  `trustProxy` was added in the v6.1 release.

### Removed
- Removed broken/obsolete/unusable multiview hack to underlying express library.

## 4.0.0 - 2021-04-21

### Changed
- **BREAKING**: Set default value for `jsonErrorLevel` to `'full'`. Deployments
  that cannot afford the performance penalty may adjust this value on an as
  needed basis.
- **BREAKING**: Set default value for `dumpExceptions` to `true`.
- **BREAKING**: Set default value for `useSession` to `false`. If `useSession`
  is set to `true`, ensure that a session storage module such as
  `bedrock-session-mongodb` is used. Otherwise, the default Express in-memory
  session store can cause memory leaks.

## 3.2.1 - 2021-03-29

### Changed
- Changed peerDependency for `bedrock` to allow `4.x`.

## 3.2.0 - 2020-06-04

### Added
- Config option for `httpOnly` that binds express to the HTTP server instead
  of the HTTPS/TLS server.

## 3.1.0 - 2020-01-11

### Changed
- By popular request, changing default error logging mode back to 'full'.

## 3.0.1 - 2019-11-19

### Fixed
- Error handler signature.

## 3.0.0 - 2019-11-08

### Added
- eslint support.
- **BREAKING**: No longer always logs full JSON errors for performance,
  privacy, and denial of service reasons. Added
  `bedrock.config.express.jsonErrorLevel` to control output. Defaults to
  `'none'` when `process.env.NODE_ENV === 'production'`, otherwise `'summary'`.
  - `'none'`: no logging
  - `'summary'`: brief summary
  - `'full'`: full JSON error as before

### Changed
- **BREAKING**: Switch from async library to async/await. Requires a modern
  runtime.
- **BREAKING**: `bedrock.config.express.dumpExceptions` now defaults to `false`
  when `process.env.NODE_ENV === 'production'`, otherwise `true`.

## 2.1.2 - 2019-10-03

### Fixed
- Fix cookie parser setup.

## 2.1.1 - 2019-05-07

### Fixed
- Attach express on `bedrock.start` instead of `bedrock.ready`. This addresses
  a condition where express may not be attached before the server is ready.

## 2.1.0 - 2018-07-06

### Added
- `asyncHandler` API allows middleware to be composed using async/await.

## 2.0.8 - 2017-10-20

### Changed
- Use a bedrock child logger.

## 2.0.7 - 2017-10-20

### Fixed
- Update `compression` dependency to address a security issue in underlying
  `debug` -> `ms` dependencies.

## 2.0.6 - 2016-07-29

### Fixed
- Ensure `bedrock-express.ready` can be canceled.

## 2.0.5 - 2016-07-22

### Fixed
- Set a default 404 status code if a file is not found on a static route.

## 2.0.4 - 2016-06-15

### Changed
- Run static middleware before any session middelware.

## 2.0.3 - 2016-06-07

### Changed
- Move `bedrock-express.ready` into `bedrock.ready`.

## 2.0.2 - 2016-03-15

### Changed
- Update bedrock dependencies.

## 2.0.1 - 2016-03-02

## 2.0.0 - 2016-03-02

### Changed
- Update package dependencies for npm v3 compatibility.

## 1.4.0 - 2015-10-17

### Changed
- Update package dependencies.

### Fixed
- Ensure error handler fallthrough occurs properly when client requests html.

## 1.4.0 - 2015-09-04

### Added
- Add `jsonErrorHandler` and `unhandledErrorHandler` middleware. Now, by
  default, when a request prefers JSON or JSON-LD and an error occurs,
  a handler will respond with a JSON/JSON-LD formatted error. This behavior
  is also exposed as middleware that can be installed manually when overriding
  the default behavior. The default unhandled error handler has also been
  exposed as middleware so it can be installed manually.

## 1.3.0 - 2015-08-25

### Added
- Add `acceptableContent` middleware.

## 1.2.0 - 2015-08-24

### Changed
- Do not parse `application/x-www-form-urlencoded` content by default. This
  adds a minor bit of protection against CSRF attacks on handlers that are
  expecting parsed JSON but may receive parsed urlencoded messages instead
  that were triggered by a malicious website.

## 1.1.1 - 2015-07-12

### Fixed
- Integrated `errorhandler` logging with bedrock logging system.

## 1.1.0 - 2015-06-23

### Added
- Parse both `application/json` and `application/*+json` as JSON. This will
  cause content with the type `application/ld+json`, for example, to be
  auto parsed as expected.

## 1.0.0 - 2015-04-08

### Changed
- Use cors 2.5.x.

## 0.2.0 - 2015-02-23

### Added
- Exposed middleware that must act like singletons, but may be configured by
more than one module, via a `middleware` object with keys that match the
middleware package name, eg: middleware['express-session'].

### Changed
- **BREAKING**: Use express `4.x`.
- **BREAKING**: `express` property is no longer exposed on the express
application. To access this, require the `bedrock-express` module and use
its API directly.
- Unused `config.express.showStack` config option removed.
- Removed deprecated `config.server.static` config option.

## 0.1.0 - 2015-02-23

- See git history for changes.
