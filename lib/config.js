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
// NOTE: setting maxAge will allow cookies to persist
// after the ttl has expired
config.express.session.cookie.maxAge = null;
// ttl is set in milliseconds
// express-session storage implementations such as MongoStore should use this.
// ttl default time is 30 minutes
config.express.session.ttl = 30 * 60 * 1000;

// server cache
config.express.cache = {};
config.express.cache.maxAge = 0;

// server static resource config
config.express.static = [];
config.express.staticOptions = {
  maxAge: config.express.cache.maxAge
};

// use session support
config.express.useSession = false;

// errors
// true for full error output (HTML, etc)
config.express.dumpExceptions = true;

// verbosity of JSON error logging
//   'none': no logging
//   'summary': log message, name, and HTTP status code if available
//   'full': log a serialize error object

// TODO: add mode to only log important server cause of exceptions
config.express.jsonErrorLevel = 'full';
