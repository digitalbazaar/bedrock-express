# bedrock-express ChangeLog

## [Unreleased]

## [1.4.0] - 2015-09-04

### Added
- Add `jsonErrorHandler` and `unhandledErrorHandler` middleware. Now, by
  default, when a request prefers JSON or JSON-LD and an error occurs,
  a handler will respond with a JSON/JSON-LD formatted error. This behavior
  is also exposed as middleware that can be installed manually when overriding
  the default behavior. The default unhandled error handler has also been
  exposed as middleware so it can be installed manually.

## [1.3.0] - 2015-08-25

### Added
- Add `acceptableContent` middleware.

## [1.2.0] - 2015-08-24

### Changed
- Do not parse `application/x-www-form-urlencoded` content by default. This
  adds a minor bit of protection against CSRF attacks on handlers that are
  expecting parsed JSON but may receive parsed urlencoded messages instead
  that were triggered by a malicious website.

## [1.1.1] - 2015-07-12

### Fixed
- Integrated `errorhandler` logging with bedrock logging system.

## [1.1.0] - 2015-06-23

### Added
- Parse both `application/json` and `application/*+json` as JSON. This will
  cause content with the type `application/ld+json`, for example, to be
  auto parsed as expected.

## [1.0.0] - 2015-04-08

### Changed
- Use cors 2.5.x.

## [0.2.0] - 2015-02-23

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


[Unreleased]: https://github.com/digitalbazaar/bedrock-express/compare/1.4.0...HEAD
[1.4.0]: https://github.com/digitalbazaar/bedrock-express/compare/1.3.0...1.4.0
[1.3.0]: https://github.com/digitalbazaar/bedrock-express/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/digitalbazaar/bedrock-express/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/digitalbazaar/bedrock-express/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/digitalbazaar/bedrock-express/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/digitalbazaar/bedrock-express/compare/0.2.0...1.0.0
[0.2.0]: https://github.com/digitalbazaar/bedrock-express/compare/0.1.0...0.2.0
