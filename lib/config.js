/*
 * Bedrock Express Module Configuration
 *
 * Copyright (c) 2012-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');

config.express = {};

// when true, only bind to the server using HTTP, not HTTPS
config.express.httpOnly = false;

// session info
config.express.session = {};
config.express.session.secret = '0123456789abcdef';
config.express.session.key = 'bedrock.sid';
config.express.session.prefix = 'bedrock.';
config.express.session.resave = true;
config.express.session.saveUninitialized = true;
config.express.session.cookie = {};
config.express.session.cookie.secure = true;
// NOTE: 'connect' doesn't update the expires age for the cookie on every
//   request so sessions will always timeout on the client after the maxAge
//   time. Setting to null will cause sessions checks to only happen on the
//   server which does update the expires time on every request. The server
//   session defaultExpirationTime is set below.
config.express.session.cookie.maxAge = null;

// server cache
config.express.cache = {};
config.express.cache.maxAge = 0;

// server static resource config
config.express.static = [];
config.express.staticOptions = {
  maxAge: config.express.cache.maxAge
};

// use session support
config.express.useSession = true;

// errors
// true for full error output (HTML, etc)
config.express.dumpExceptions = process.env.NODE_ENV !== 'production';
// verbosity of JSON error logging
//   'none': no logging
//   'summary': log message, name, and HTTP status code if available
//   'full': log a serialize error object
// default to 'none' in production mode, otherwise 'full'
// TODO: add mode to only log important server cause of exceptions
config.express.jsonErrorLevel =
  process.env.NODE_ENV === 'production' ? 'none' : 'full';
