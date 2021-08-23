/*
 * Copyright (c) 2012-2020 Digital Bazaar, Inc. All rights reserved.
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
const {BedrockError} = bedrock.util;

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

// create express application
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
  if(bedrock.config.express.httpOnly) {
    // attach express to HTTP only
    base = bedrockServer.servers.http;
  } else {
    // attach express to TLS
    base = bedrockServer.servers.https;
  }
  const server = Object.create(base);
  // set `_fastify` as underlying implementation for `fastify` proxy
  _fastify = Fastify({
    serverFactory(requestHandler) {
      server.listen = (options, callback) => {
        // we are already listening so just attach the fastify request handler
        server.on('request', requestHandler);
        callback();
      };
      return server;
    }
  });

  // add express compatibility layer to fastify
  await fastify.register(fastifyExpress);

  // init
  await bedrock.events.emit('bedrock-express.fastify.init', {fastify, app});
  await bedrock.events.emit('bedrock-express.init', app);
  // basic config
  app.enable('trust proxy');
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
    for(let i = bedrock.config.express.static.length - 1; i >= 0; --i) {
      let cfg = bedrock.config.express.static[i];
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
        app.use(cfg.route, express.static(
          p, bedrock.config.express.staticOptions));
      }
    }
    // if any non-root static route fails to serve a file, set a 404 status
    // code, but do not send it
    for(let i = bedrock.config.express.static.length - 1; i >= 0; --i) {
      const cfg = bedrock.config.express.static[i];
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
    app.use(require('cookie-parser')(bedrock.config.express.session.secret));
  }
  // session config
  const configSession =
    await bedrock.events.emit('bedrock-express.configure.session', app);
  if(configSession !== false) {
    if(bedrock.config.express.useSession) {
      app.use(api.middleware['express-session'](
        bedrock.config.express.session));
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

  // do not attach if ready was canceled
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
    switch(bedrock.config.express.jsonErrorLevel) {
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
  if(bedrock.config.express.dumpExceptions) {
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
  return (req, res) => res.sendFile(file, bedrock.config.express.staticOptions);
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
