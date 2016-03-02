# bedrock-express

A [bedrock][] module that integrates [express][] with [bedrock][] to provide
a routing framework and other features for writing Web applications. It
uses the [bedrock][] event system to emit a number of configuration
events that dependent modules may use to add features to a core [express][]
server.

## Requirements

- npm v3+

## Quick Examples

```
npm install bedrock-express
```

```js
var bedrock = require('bedrock');

bedrock.events.on('bedrock-express.configure.routes', addRoutes);

function addRoutes(app) {
  app.get('/', function(req, res) {
    res.send('Hello World!');
  });
}
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## How It Works

**bedrock-express** exposes an express server over TLS, using the
[bedrock-server][] module. It takes the approach that most applications built
on express set it up in very similar ways. Therefore, **bedrock-express** sets
up a default express server using very common options and middleware, but lets
other modules decide which parts to change or turn off. For simple changes,
modules can use `bedrock.config.express` to configure the express server. For
more complex changes or to cancel chosen default behavior entirely, modules
can use the events that **bedrock-express** emits.

**bedrock-express** will begin setting up the express server and emitting its
events when the core `bedrock.start` event is emitted. When the `bedrock.ready`
event is emitted, **bedrock-express** will attach the express server to
the `bedrock-server` HTTPS server to begin accepting requests.

### Events

**bedrock-express** emits several events that modules may listen for. Most of
these events are emitted during the setup process of a default express server,
allowing modules to change only the behavior they are interested in
customizing. Every event emitted will pass the express server object as the
first parameter to the listener function. The most commonly used event is
`bedrock-express.configure.routes`, which allows modules to attach new routes
to express to provide, for example, a REST API.

- **bedrock-express.init**
  - Emitted before any other setup of the express server.
- **bedrock-express.configure.logger**
  - Emitted before binding bedrock's logging system to express. By default,
    the express middleware, [morgan][], is used to write `combined` server
    access information to bedrock's `access` logger. This event can be used to
    log server access in another way and/or it can be canceled to prevent
    logging to bedrock's `access` logger.
- **bedrock-express.configure.bodyParser**
  - Emitted before the default body parser is setup. By default, express
    will parse `application/json` message bodies into JavaScript objects. It
    will not parse `application/x-www-form-urlencoded` as a minor attempt to
    help prevent CSRF attacks on handlers that expect parsed JSON but may
    receive parsed `application/x-www-form-urlencoded` messages instead.
    Listeners of this event can change default parsing behavior or turn it off
    by canceling this event.
- **bedrock-express.configure.cookieParser**
  - Emitted before the default cookie parser is setup. Be default, the
    express middleware, [cookie-parser][], is used, configured using the
    the `bedrock.config.express.session.secret` configuration value. Listeners
    can use this event to replace or simply cancel this behavior.
- **bedrock-express.configure.session**
  - Emitted before the default session handle is setup. By default, the
    express middleware, [express-session][], is installed and uses the
    `bedrock.config.express.session` configuration object. Listeners can use
    this event to initialize session storage or to replace or cancel the
    default session handling behavior entirely.
- **bedrock-express.configure.static**
  - Emitted before the default static content handler is configured. By
    default, bedrock-express provides the ability to configure multiple
    static routes. A handler for each route configuration found in the
    `bedrock.config.express.static` array will be registered with express.
    Route configurations may specify files or entire paths to serve, and
    whether or not CORS should be enabled. The handlers will be added in the
    reverse order of the array. This gives priority to route configurations
    that were pushed onto the array last, should there be more than one handler
    for a particular route. This means that when a request is received by
    express that matches a particular route, the handler that will be given
    the first opportunity to respond will be the last in the array that matches
    the route. If that handler cannot find a file to send, then the
    second-to-last handler created with a matching route will be executed, and
    so forth. The approach allows projects to easily override which static
    files are sent for a particular route via the configuration system.
- **bedrock-express.configure.cache**
  - Emitted after `bedrock-express.configure.static` and before the default
    cache handler for dynamic content is installed. By default, caching for
    dynamic content is disabled by setting these headers:
    - Cache-Control: no-cache, no-store, must-revalidate
    - Pragma: no-cache
    - Expires: 0
    Listeners may replace and/or cancel this behavior.
- **bedrock-express.configure.router**
  - Emitted before any routes are added to the default express router.
- **bedrock-express.configure.routes**
  - Emitted after `bedrock-express.configure.router` to allow modules to
    add routes to express. This is the most common event for modules to bind
    to. A module should attach a listener to this event to expose, for example,
    a REST API.
- **bedrock-express.configure.errorHandlers**
  - Emitted after `bedrock-express.configure.routes` to handle any errors that
    routes may have generated. Listeners can use this event to attach custom
    error handlers.
- **bedrock-express.configure.unhandledErrorHandler**
  - Emitted after `bedrock-express.configure.errorHandlers` to attach a
    handler for any unhandled errors. By default, an unhandled error handler
    is installed that changes its behavior based on whether or not
    `bedrock.config.express.dumpExceptions` is `true`. If it is `true`, then an
    error and stack trace will be displayed in html or sent via JSON, depending
    on the client's request. If it is not set, then an unhandled error handler
    is attached that will send a `500 Internal Server Error` in `text/plain`
    unless the error itself specifies a different message and/or status code
    to send.
- **bedrock-express.start**
  - Emitted before `bedrock-express.ready` to allow listeners to perform any
    custom behavior prior to the express server announcing it is ready.
- **bedrock-express.ready**
  - Emitted after `bedrock-express.start`, indicating that all listeners
    should have already completed any special custom behavior on start up.


[bedrock]: https://github.com/digitalbazaar/bedrock
[bedrock-server]: https://github.com/digitalbazaar/bedrock-server
[cookie-parser]: https://github.com/expressjs/cookie-parser
[express]: https://github.com/strongloop/express
[morgan]: https://github.com/expressjs/morgan
[session]: https://github.com/expressjs/session
