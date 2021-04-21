# bedrock-express ChangeLog

## 4.0.0 - TBD

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
