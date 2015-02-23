# bedrock-express ChangeLog

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


[Unreleased]: https://github.com/digitalbazaar/bedrock-express/compare/0.1.0...HEAD
