/*
 * Copyright (c) 2012-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const asyncHandler = require('express-async-handler');
const bedrock = require('bedrock');
const bedrockServer = require('bedrock-server');
const bodyParser = require('body-parser');
const Fastify = require('fastify');
const fastifyExpress = require('fastify-express');
const logger = require('./logger');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const {config, util: {BedrockError}} = bedrock;

// load config defaults
require('./config');

// create fastify proxy to enable modules to destructure `fastify` before it
// is ready for use; fastify will not be ready for use until
// `bedrock-express.fastify.init` is emitted
let _fastify = null;
const fastify = _createFastifyProxy();

// module api
const api = {
  asyncHandler, express, Fastify, fastify, middleware: {}
};
module.exports = api;

// create express application that bedrock modules will add routes to; a future
// non-backwards compatibility implementation could consolidate this express
// app with the one created by fastify -- it can't be consolidated now because
// the latter one will only be created once `bedrock-express.fastify.init` has
// been emitted and this one is created and exposed immediately
const app = api.app = express();

// expose middleware singletons
api.middleware.morgan = morgan;
api.middleware['express-session'] = require('express-session');
api.middleware.acceptableContent = _acceptableContent;
api.middleware.jsonErrorHandler = _handleJsonError;
api.middleware.unhandledErrorHandler = _handleError;

// redefine logger token for remote-addr to use express-parsed ip
// (includes X-Forwarded-For header if available)
morgan.token('remote-addr', req => req.ip);

// default jsonld mimetype
express.static.mime.define({'application/ld+json': ['jsonld']});

// setup express app on bedrock start
bedrock.events.on('bedrock.start', async () => {
  /* Note: Since fastify does its own listening via `fastify.listen` and
  bedrock-server is already listening, we need to use the `serverFactory`
  option to customize the server's listening behavior to be compatible. */

  // create server that inherits from `http` or `https` server based
  // on the configuration
  let base;
  if(config.express.httpOnly) {
    // attach express to HTTP only
    base = bedrockServer.servers.http;
  } else {
    // attach express to TLS
    base = bedrockServer.servers.https;
  }
  const server = Object.create(base);
  // set `_fastify` as underlying implementation for `fastify` proxy
  _fastify = Fastify({
    ...config.express.fastifyOptions,
    serverFactory(requestHandler) {
      // expose request handler
      api.requestHandler = requestHandler;
      server.listen = (options, callback) => {
        // we are already listening so just attach the fastify request handler
        server.on('request', requestHandler);
        callback();
      };
      return server;
    }
  });

  // if server is native http2...
  const isNativeHttp2 = server.constructor.name.startsWith('Http2');
  if(isNativeHttp2) {
    // add http2 support to app
    _addHttp2Support(app);
  }

  // add hook that will run before the express compatibility hooks added by
  // fastify-express below
  fastify.addHook('onRequest', function expressHttp2(req, reply, next) {
    // add express APIs to req.raw/reply.raw
    const {_http2, request, response} = fastify.express;
    if(_http2) {
      // if http2 is used, augment response w/API from express.response; but
      // if http1 is used, just set prototype because augmentation creates
      // a bug where outgoing messages are never flushed
      const isHttp2Request = req.raw.httpVersion &&
        req.raw.httpVersion.startsWith('2');
      if(isHttp2Request) {
        // support `host` header via http2 `:authority` header
        if(!req.raw.headers.host) {
          req.raw.headers.host = req.raw.headers[':authority'];
        }

        reply.raw = _http2.augment(reply.raw, response, 'response');
        if(!reply.raw._implicitHeader) {
          reply.raw._implicitHeader = function() {
            this.writeHead(this.statusCode);
          };
        }
      } else {
        // overriding prototype avoids bug w/http1 outgoing messages for
        // presently unknown reasons; a future fix could optimize this away
        Object.setPrototypeOf(reply.raw, response);
      }

      // always augment request w/API from express app.request
      req.raw = _http2.augment(req.raw, request, 'request');

      // create app reference that reflects request and response prototypes
      // to avoid overriding them further
      req.raw.app = _http2.reflect(req.raw, reply.raw);
    }

    next();
  });

  // add express compatibility layer to fastify; this translates the express
  // API to fastify's
  await fastify.register(fastifyExpress);

  // if server is native http2, add http2 support to fastify express app,
  // otherwise (e.g., `spdy` is used) this is unnecessary
  if(isNativeHttp2) {
    _addHttp2Support(fastify.express);
  }

  // init
  await bedrock.events.emit('bedrock-express.fastify.init', {fastify, app});
  await bedrock.events.emit('bedrock-express.init', app);
  // basic config
  app.disable('x-powered-by');
  // logger config
  const configLogger =
    await bedrock.events.emit('bedrock-express.configure.logger', app);
  if(configLogger !== false) {
    const accessLogger = bedrock.loggers.get('access');
    app.use(morgan('combined', {
      stream: {write: str => accessLogger.log('info', str)}
    }));
  }
  // static config
  const configStatic =
    await bedrock.events.emit('bedrock-express.configure.static', app);
  if(configStatic !== false) {
    // compress static content
    app.use(require('compression')());
    // add each static path
    for(let i = config.express.static.length - 1; i >= 0; --i) {
      let cfg = config.express.static[i];
      if(typeof cfg === 'string') {
        cfg = {route: '/', path: cfg};
      }
      // setup cors
      let corsHandler = null;
      if('cors' in cfg) {
        if(typeof cfg.cors === 'boolean' && cfg.cors) {
          // if boolean and true just use defaults
          corsHandler = cors();
        } else {
          // if object, use as cors config
          corsHandler = cors(cfg.cors);
        }
      }

      const p = path.resolve(cfg.path);
      if(cfg.file) {
        // serve single file
        logger.debug('serving route: "' + cfg.route +
          '" with file: "' + p + '"');
        if(corsHandler) {
          app.use(cfg.route, corsHandler);
        }
        app.use(cfg.route, _serveFile(p));
      } else {
        // serve directory
        logger.debug('serving route: "' + cfg.route +
          '" with dir: "' + p + '"');
        if(corsHandler) {
          app.use(cfg.route, corsHandler);
        }
        app.use(cfg.route, express.static(p, config.express.staticOptions));
      }
    }
    // if any non-root static route fails to serve a file, set a 404 status
    // code, but do not send it
    for(let i = config.express.static.length - 1; i >= 0; --i) {
      const cfg = config.express.static[i];
      if(typeof cfg === 'string' || cfg.route === '/') {
        continue;
      }
      // set 404 status if file is not found in static path
      app.use(cfg.route, (req, res, next) => {
        res.status(404);
        next();
      });
    }
  }
  // cache config
  const configCache =
    await bedrock.events.emit('bedrock-express.configure.cache', app);
  if(configCache !== false) {
    // done after static to prevent caching non-static resources only
    app.use((req, res, next) => {
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
      next();
    });
  }
  // body parser config
  app.use(require('method-override')());
  const configBodyParser =
    await bedrock.events.emit('bedrock-express.configure.bodyParser', app);
  if(configBodyParser !== false) {
    // parse application/json, application/*+json
    app.use(bodyParser.json({type: ['json', '+json']}));
    // Note: Do *NOT* parse `application/x-www-form-urlencoded` by default;
    // it makes protecting JSON-based handlers from CSRF more difficult
  }
  // cookie parser config
  const configCookieParser =
    await bedrock.events.emit('bedrock-express.configure.cookieParser', app);
  if(configCookieParser !== false) {
    app.use(require('cookie-parser')(config.express.session.secret));
  }
  // session config
  const configSession =
    await bedrock.events.emit('bedrock-express.configure.session', app);
  if(configSession !== false) {
    if(config.express.useSession) {
      app.use(api.middleware['express-session'](config.express.session));
    }
  }
  // router config
  await bedrock.events.emit('bedrock-express.configure.router', app);
  // routes config
  await bedrock.events.emit('bedrock-express.configure.routes', app);
  // error handler config
  await bedrock.events.emit('bedrock-express.configure.errorHandlers', app);
  // unhandled error handler config
  const configUnhandledErrorHandler = await bedrock.events.emit(
    'bedrock-express.configure.unhandledErrorHandler', app);
  if(configUnhandledErrorHandler !== false) {
    app.use(_handleJsonError());
    app.use(_handleError());
  }
  // start
  await bedrock.events.emit('bedrock-express.start', app);

  // ready check
  let canceled = await bedrock.events.emit(
    'bedrock-express.ready', app) === false;
  // do not attach if ready was canceled
  if(canceled) {
    return;
  }

  // add express app to fastify
  fastify.use(app);

  // fastify ready check
  canceled = await bedrock.events.emit(
    'bedrock-express.fastify.ready', app) === false;
  // do not attach if ready was canceled
  if(canceled) {
    return;
  }

  bedrock.events.on('bedrock-server.ready', async () => {
    /* Activate fastify. Note that `server` may have been bound to multiple
    addresses but `server.address()` only returns the first one; that is ok
    here because we have overridden `server.listen` to not actually do anything
    other than attach the request listener since it is already listening. The
    `host` and `port` are only used in a fastify log message. */
    const {address: host, port} = server.address();
    await fastify.listen({host, port});
  });
});

// creates middleware for handling JSON/JSON-LD errors
function _handleJsonError() {
  return (err, req, res, next) => {
    // set default status code 500
    if(res.statusCode < 400) {
      res.statusCode = 500;
    }

    if(err instanceof BedrockError) {
      // TODO: document why this is only set on a GET vs. other methods
      // if PermissionDenied is set on a GET, use a 403 status code
      if(req.method === 'GET' && err.name === 'PermissionDenied') {
        res.statusCode = 403;
      } else if(err.name === 'NotFound') {
        res.statusCode = 404;
      }
      // refine status code if given in top-level error
      if(err.details && err.details.httpStatusCode) {
        res.statusCode = err.details.httpStatusCode;
      }
    } else {
      // wrap non-bedrock errors and prevent information leakage in
      // non-development mode
      err = new BedrockError('An error occurred.', 'Error', null, err);
    }

    // TODO: check for 'critical' in exception chain and use that?
    // TODO: rate limit
    // log error
    switch(config.express.jsonErrorLevel) {
      case 'none': {
        // no logging
        break;
      }
      case 'summary': {
        // name, message, and httpStatusCode
        const details = {
          name: err.name,
          message: err.message
        };
        if(err.details && err.details.httpStatusCode) {
          details.httpStatusCode = err.details.httpStatusCode;
        }
        logger.error('error', details);
        break;
      }
      case 'full': {
        // full error
        logger.error('error', {error: err.toObject()});
        break;
      }
    }

    // security header for content sniffing (eg: prevent browsers from
    // downloading extensions based on content in the error that may
    // not have come from this server)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // TODO: this call will currently send JSON/JSON-LD if it is preferred
    // over html, however, it should actually only send JSON/JSON-LD if it
    // is preferred over *every* other media type, not just html, but there
    // doesn't (yet) appear to be an API to call to make this happen easily

    // only handle JSON/JSON-LD when it's preferred over other media types
    const preferred = req.accepts(
      ['text/html', 'application/ld+json', 'application/json']);
    if(preferred === 'text/html') {
      // defer to next handler
      return next(err);
    }
    if(preferred) {
      // output public error
      return res.json(err.toObject({public: true}));
    }
    // defer to next handler
    return next(err);
  };
}

function _handleError() {
  if(config.express.dumpExceptions) {
    // development handler shows full stack information in HTML
    return require('errorhandler')({
      log: (err, str) => logger.verbose(str, {error: err})
    });
  }
  // default error handler
  /* eslint-disable-next-line no-unused-vars */
  return (err, req, res, next) => {
    // if err.status is set, respect it and the error message
    let msg = 'Internal Server Error';
    if(err.status) {
      res.statusCode = err.status;
      msg = err.message;
    }
    // cannot actually respond
    if(res._header) {
      return req.socket.destroy();
    }
    res.setHeader('Content-Type', 'text/plain');
    res.end(msg);
  };
}

// creates middleware for serving a single static file
function _serveFile(file) {
  return (req, res) => res.sendFile(file, config.express.staticOptions);
}

function _acceptableContent(options) {
  if(arguments.length > 1) {
    options = {contentType: Array.prototype.slice.call(arguments)};
  } else if(typeof options === 'string') {
    options = {contentType: [options]};
  } else if(Array.isArray(options)) {
    options = {contentType: options};
  }
  return (req, res, next) => {
    if(req.is(options.contentType)) {
      return next();
    }
    res.status(415).send();
  };
}

function _createFastifyProxy() {
  return new Proxy({}, {
    get(target, propKey) {
      if(!_fastify) {
        throw _invalidStateError();
      }
      return _fastify[propKey];
    },
    getPrototypeOf() {
      if(!_fastify) {
        throw _invalidStateError();
      }
      return Object.getPrototypeOf(_fastify);
    },
    getOwnPropertyDescriptor(target, prop) {
      if(!_fastify) {
        throw _invalidStateError();
      }
      return Object.getOwnPropertyDescriptor(_fastify, prop);
    },
    set(target, prop, value) {
      if(!_fastify) {
        throw _invalidStateError();
      }
      _fastify[prop] = value;
      return true;
    }
  });
}

function _invalidStateError() {
  return new BedrockError('Fastify is not ready.', 'InvalidStateError');
}

/**
 * Adds native http2 support to an express app. This involves eliminating the
 * prototype overwriting that express 4.x does on request and response objects.
 * As long as no middleware also performs its own prototype overwriting
 * (unusual) this will behave properly.
 */
function _addHttp2Support(app) {
  // cache of computed property descriptors to be added to req/res
  const descriptorCache = {request: null, response: null};
  app._http2 = {
    /* This function augments the given target request or response using the
    property descriptors associated with the given source. */
    augment(target, source, type) {
      // the descriptors only need to be built once, not on every augmentation
      let descriptors = descriptorCache[type];
      if(!descriptors) {
        // compute descriptors by getting all descriptors in the prototype
        // chain for `source`
        descriptors = {};
        const allDescriptors = [];
        let prototype = source;
        while(prototype) {
          allDescriptors.push(Object.getOwnPropertyDescriptors(prototype));
          prototype = Object.getPrototypeOf(prototype);
        }
        for(const d of allDescriptors.reverse()) {
          descriptors = {...descriptors, ...d};
        }
        // remove special case properties that will be set by fastify-express
        delete descriptors.hostname;
        delete descriptors.ip;
        delete descriptors.ips;
        // remove any descriptors that are already set on the target
        for(const prop in descriptors) {
          if(prop in target) {
            delete descriptors[prop];
          }
        }
        descriptorCache[type] = descriptors;
      }
      return Object.create(target, descriptors);
    },
    /* This function creates an app wrapper that will return the prototype of
    `req` and the prototype of `res` when using the `app.request` and
    `app.response` properties. This ensures that when express calls
    `setPrototypeOf` when using this wrapper, it will be a no-op (an the
    ECMAScript 2020 spec says so). Express makes the `setPrototypeOf` call when
    installing express applications into other ones using `.use()`. */
    reflect(req, res) {
      const wrapper = _createAppWrapper(
        app, Object.getPrototypeOf(req), Object.getPrototypeOf(res));
      wrapper._reflected = true;
      return wrapper;
    }
  };

  /* Note: This manually sets up the base router with a `customExpressInit`
  replacement to avoid changing req/res prototypes on initialization. The above
  `reflect()` function only prevents prototypes from getting set when an
  express app that has been installed in another one hands control back to
  its parent. It does not handle preventing prototype setting within the app
  itself -- this does. */
  app.lazyrouter();
  app._router.stack.pop();
  app._router.use(_customExpressInit);
}

// custom express init middleware that does not override req/res prototypes
function _customExpressInit(req, res, next) {
  req.res = res;
  res.req = req;
  if(req.app && req.app._http2 && !req.app._reflected) {
    req.app = req.app._http2.reflect(req, res);
  }
  req.next = next;
  res.locals = res.locals || Object.create(null);
  next();
}

function _createAppWrapper(app, request, response) {
  return Object.create(app, {
    request: {
      configurable: true, enumerable: true, writable: true, value: request
    },
    response: {
      configurable: true, enumerable: true, writable: true, value: response
    }
  });
}
