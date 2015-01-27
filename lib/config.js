/*
 * Bedrock Express Module Configuration
 *
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;

config.express = {};

// session info
config.express.session = {};
config.express.session.secret = '0123456789abcdef';
config.express.session.key = 'bedrock.sid';
config.express.session.prefix = 'bedrock.';
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

// TODO: remove, config.server.static is deprecated
config.server.static = config.express.static;
