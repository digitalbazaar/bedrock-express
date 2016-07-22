/*
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var async = require('async');
var bedrock = require('bedrock');
var bedrockServer = require('bedrock-server');
var bodyParser = require('body-parser');
var cors = require('cors');
var express = require('express');
var morgan = require('morgan');
var path = require('path');
var BedrockError = bedrock.util.BedrockError;

// load config defaults
require('./config');

// module api
var api = {express: express, middleware: {}};
module.exports = api;

// modify express to allow multiple view roots
_allowMultipleViewRoots();

// create express server
var server = api.app = express();

// expose middleware singletons
api.middleware.morgan = morgan;
api.middleware['express-session'] = require('express-session');
api.middleware.acceptableContent = _acceptableContent;
api.middleware.jsonErrorHandler = _handleJsonError;
api.middleware.unhandledErrorHandler = _handleError;

// redefine logger token for remote-addr to use express-parsed ip
// (includes X-Forwarded-For header if available)
morgan.token('remote-addr', function(req) {
  return req.ip;
});

// default jsonld mimetype
express.static.mime.define({'application/ld+json': ['jsonld']});

// track when bedrock is ready to attach express
bedrock.events.on('bedrock.ready', function(callback) {
  bedrock.events.emit('bedrock-express.ready', server, function(err) {
    if(err) {
      return callback(err);
    }
    // attach express to TLS
    bedrockServer.servers.https.on('request', server);
    callback();
  });
});

// setup server on bedrock start
bedrock.events.on('bedrock.start', init);

function init(callback) {
  async.auto({
    init: function(callback) {
      bedrock.events.emit('bedrock-express.init', server, callback);
    },
    beforeLogger: ['init', function(callback) {
      // basic config
      server.enable('trust proxy');
      server.disable('x-powered-by');
      bedrock.events.emit('bedrock-express.configure.logger', server, callback);
    }],
    logger: ['beforeLogger', function(callback, results) {
      if(results.beforeLogger === false) {
        return callback();
      }
      var accessLogger = bedrock.loggers.get('access');
      server.use(morgan('combined', {
        stream: {write: function(str) {accessLogger.log('info', str);}}
      }));
      callback();
    }],
    beforeStatic: ['logger', function(callback) {
      bedrock.events.emit('bedrock-express.configure.static', server, callback);
    }],
    static: ['beforeStatic', function(callback, results) {
      if(results.beforeStatic === false) {
        return callback();
      }
      // compress static content
      server.use(require('compression')());
      // add each static path
      var logger = bedrock.loggers.get('app');
      for(var i = bedrock.config.express.static.length - 1; i >= 0; --i) {
        var cfg = bedrock.config.express.static[i];
        if(typeof cfg === 'string') {
          cfg = {route: '/', path: cfg};
        }
        // setup cors
        var corsHandler = null;
        if('cors' in cfg) {
          if(typeof cfg.cors === 'boolean' && cfg.cors) {
            // if boolean and true just use defaults
            corsHandler = cors();
          } else {
            // if object, use as cors config
            corsHandler = cors(cfg.cors);
          }
        }

        var p = path.resolve(cfg.path);
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
      // if any static route fails to serve a file, set a 404 status code
      // but do not send it
      for(var i = bedrock.config.express.static.length - 1; i >= 0; --i) {
        var cfg = bedrock.config.express.static[i];
        if(typeof cfg === 'string') {
          cfg = {route: '/', path: cfg};
        }
        // set 404 status if file is not found in static path
        server.use(cfg.route, function(req, res, next) {
          res.status(404);
          next();
        });
      }
      callback();
    }],
    beforeCache: ['static', function(callback) {
      bedrock.events.emit('bedrock-express.configure.cache', server, callback);
    }],
    cache: ['beforeCache', function(callback, results) {
      if(results.beforeCache === false) {
        return callback();
      }
      // done after static to prevent caching non-static resources only
      server.use(function(req, res, next) {
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');
        next();
      });
      callback();
    }],
    beforeBodyParser: ['cache', function(callback) {
      server.use(require('method-override')());
      bedrock.events.emit(
        'bedrock-express.configure.bodyParser', server, callback);
    }],
    bodyParser: ['beforeBodyParser', function(callback, results) {
      if(results.beforeBodyParser === false) {
        return callback();
      }
      // parse application/json, application/*+json
      server.use(bodyParser.json({type: ['json', '+json']}));
      // Note: Do *NOT* parse `application/x-www-form-urlencoded` by default;
      // it makes protecting JSON-based handlers from CSRF more difficult
      callback();
    }],
    beforeCookieParser: ['bodyParser', function(callback) {
      bedrock.events.emit(
        'bedrock-express.configure.cookieParser', server, callback);
    }],
    cookieParser: ['bodyParser', function(callback, results) {
      if(results.bodyParser === false) {
        return callback();
      }
      server.use(require('cookie-parser')(
        bedrock.config.express.session.secret));
      callback();
    }],
    beforeSession: ['cookieParser', function(callback) {
      bedrock.events.emit(
        'bedrock-express.configure.session', server, callback);
    }],
    session: ['beforeSession', function(callback, results) {
      if(results.beforeSession === false) {
        return callback();
      }
      if(bedrock.config.express.useSession) {
        server.use(api.middleware['express-session'](
          bedrock.config.express.session));
      }
      callback();
    }],
    beforeRouter: ['session', function(callback) {
      bedrock.events.emit('bedrock-express.configure.router', server, callback);
    }],
    router: ['beforeRouter', function(callback) {
      callback();
    }],
    beforeRoutes: ['router', function(callback) {
      bedrock.events.emit('bedrock-express.configure.routes', server, callback);
    }],
    routes: ['beforeRoutes', function(callback, results) {
      if(results.beforeRoutes === false) {
        return callback();
      }
      callback();
    }],
    errorHandlers: ['routes', function(callback) {
      bedrock.events.emit(
        'bedrock-express.configure.errorHandlers', server, callback);
    }],
    beforeUnhandledErrorHandler: ['errorHandlers', function(callback) {
      bedrock.events.emit(
        'bedrock-express.configure.unhandledErrorHandler', server, callback);
    }],
    unhandledErrorHandler: [
      'beforeUnhandledErrorHandler', function(callback, results) {
      if(results.beforeUnhandledErrorHandler === false) {
        return callback();
      }
      server.use(_handleJsonError());
      server.use(_handleError());
      callback();
    }],
    start: ['unhandledErrorHandler', function(callback) {
      bedrock.events.emit('bedrock-express.start', server, callback);
    }]
    // Note: 'bedrock-express.ready' emitted in 'bedrock.ready' handler
  }, function(err) {
    callback(err);
  });
}

// creates middleware for handling JSON/JSON-LD errors
function _handleJsonError() {
  var logger = bedrock.loggers.get('app');
  return function(err, req, res, next) {
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
    var preferred = req.accepts(
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
    var logger = bedrock.loggers.get('app');
    return require('errorhandler')({
      log: function(err, str) {
        logger.verbose(str, {error: err});
      }
    });
  }
  // default error handler
  return function(err, req, res, next) {
    // if err.status is set, respect it and the error message
    var msg = 'Internal Server Error';
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
  return function(req, res) {
    res.sendFile(file, bedrock.config.express.staticOptions);
  };
}

// allows multiple view root paths to be used
function _allowMultipleViewRoots() {
  var View = require('express/lib/view');
  var old = View.prototype.lookup;
  View.prototype.lookup = function(path) {
    var self = this;
    var root = self.root;
    // if root is an array, try each root in reverse order until path exists
    if(Array.isArray(root)) {
      var foundPath;
      for(var i = root.length - 1; i >= 0; --i) {
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
  return function(req, res, next) {
    if(req.is(options.contentType)) {
      return next();
    }
    res.status(415).send();
  };
}
