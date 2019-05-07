/*
 * Copyright (c) 2012-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const asyncHandler = require('express-async-handler');
const bedrock = require('bedrock');
const bedrockServer = require('bedrock-server');
const bodyParser = require('body-parser');
const childLogger = require('./logger');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const {BedrockError} = bedrock.util;

// load config defaults
require('./config');

// module api
const api = {asyncHandler, express, middleware: {}};
module.exports = api;

// modify express to allow multiple view roots
_allowMultipleViewRoots();

// create express server
const server = api.app = express();

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

// setup server on bedrock start
bedrock.events.on('bedrock.start', init);

function init(callback) {
  async.auto({
    init: callback => bedrock.events.emit(
      'bedrock-express.init', server, callback),
    beforeLogger: ['init', callback => {
      // basic config
      server.enable('trust proxy');
      server.disable('x-powered-by');
      bedrock.events.emit('bedrock-express.configure.logger', server, callback);
    }],
    logger: ['beforeLogger', (callback, results) => {
      if(results.beforeLogger === false) {
        return callback();
      }
      const accessLogger = bedrock.loggers.get('access');
      server.use(morgan('combined', {
        stream: {write: str => accessLogger.log('info', str)}
      }));
      callback();
    }],
    beforeStatic: ['logger', callback => bedrock.events.emit(
      'bedrock-express.configure.static', server, callback)],
    static: ['beforeStatic', (callback, results) => {
      if(results.beforeStatic === false) {
        return callback();
      }
      // compress static content
      server.use(require('compression')());
      // add each static path
      const logger = childLogger;
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
            server.use(cfg.route, corsHandler);
          }
          server.use(cfg.route, _serveFile(p));
        } else {
          // serve directory
          logger.debug('serving route: "' + cfg.route +
            '" with dir: "' + p + '"');
          if(corsHandler) {
            server.use(cfg.route, corsHandler);
          }
          server.use(cfg.route, express.static(
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
        server.use(cfg.route, (req, res, next) => {
          res.status(404);
          next();
        });
      }
      callback();
    }],
    beforeCache: ['static', callback => bedrock.events.emit(
      'bedrock-express.configure.cache', server, callback)],
    cache: ['beforeCache', (callback, results) => {
      if(results.beforeCache === false) {
        return callback();
      }
      // done after static to prevent caching non-static resources only
      server.use((req, res, next) => {
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');
        next();
      });
      callback();
    }],
    beforeBodyParser: ['cache', callback => {
      server.use(require('method-override')());
      bedrock.events.emit(
        'bedrock-express.configure.bodyParser', server, callback);
    }],
    bodyParser: ['beforeBodyParser', (callback, results) => {
      if(results.beforeBodyParser === false) {
        return callback();
      }
      // parse application/json, application/*+json
      server.use(bodyParser.json({type: ['json', '+json']}));
      // Note: Do *NOT* parse `application/x-www-form-urlencoded` by default;
      // it makes protecting JSON-based handlers from CSRF more difficult
      callback();
    }],
    beforeCookieParser: ['bodyParser', callback => bedrock.events.emit(
      'bedrock-express.configure.cookieParser', server, callback)],
    cookieParser: ['bodyParser', (callback, results) => {
      if(results.bodyParser === false) {
        return callback();
      }
      server.use(require('cookie-parser')(
        bedrock.config.express.session.secret));
      callback();
    }],
    beforeSession: ['cookieParser', callback => bedrock.events.emit(
      'bedrock-express.configure.session', server, callback)],
    session: ['beforeSession', (callback, results) => {
      if(results.beforeSession === false) {
        return callback();
      }
      if(bedrock.config.express.useSession) {
        server.use(api.middleware['express-session'](
          bedrock.config.express.session));
      }
      callback();
    }],
    beforeRouter: ['session', callback => bedrock.events.emit(
      'bedrock-express.configure.router', server, callback)],
    router: ['beforeRouter', callback => callback()],
    beforeRoutes: ['router', callback => bedrock.events.emit(
      'bedrock-express.configure.routes', server, callback)],
    routes: ['beforeRoutes', (callback, results) => {
      if(results.beforeRoutes === false) {
        return callback();
      }
      callback();
    }],
    errorHandlers: ['routes', callback => bedrock.events.emit(
      'bedrock-express.configure.errorHandlers', server, callback)],
    beforeUnhandledErrorHandler: ['errorHandlers', callback =>
      bedrock.events.emit(
        'bedrock-express.configure.unhandledErrorHandler', server, callback)],
    unhandledErrorHandler: [
      'beforeUnhandledErrorHandler', (callback, results) => {
        if(results.beforeUnhandledErrorHandler === false) {
          return callback();
        }
        server.use(_handleJsonError());
        server.use(_handleError());
        callback();
      }],
    start: ['unhandledErrorHandler', callback => bedrock.events.emit(
      'bedrock-express.start', server, callback)],
    ready: ['start', callback => bedrock.events.emit(
      'bedrock-express.ready', server, callback)],
    attach: ['ready', (callback, results) => {
      if(results.ready === false) {
        // default attach canceled, return early
        return callback();
      }
      // attach express to TLS
      bedrockServer.servers.https.on('request', server);
      callback();
    }]
  }, err => callback(err));
}

// creates middleware for handling JSON/JSON-LD errors
function _handleJsonError() {
  const logger = childLogger;
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

    // TODO: check for 'critical' in exception chain and use that
    // log message instead of error
    logger.error('Error', {error: err.toObject()});

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
    const logger = childLogger;
    return require('errorhandler')({
      log: (err, str) => logger.verbose(str, {error: err})
    });
  }
  // default error handler
  return (err, req, res) => {
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

// allows multiple view root paths to be used
function _allowMultipleViewRoots() {
  const View = require('express/lib/view');
  const old = View.prototype.lookup;
  View.prototype.lookup = function(path) {
    const self = this;
    const root = self.root;
    // if root is an array, try each root in reverse order until path exists
    if(Array.isArray(root)) {
      let foundPath;
      for(let i = root.length - 1; i >= 0; --i) {
        self.root = root[i];
        foundPath = old.call(self, path);
        if(foundPath) {
          break;
        }
      }
      self.root = root;
      return foundPath;
    }
    // fallback to standard behavior, when root is a single directory
    return old.call(self, path);
  };
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
