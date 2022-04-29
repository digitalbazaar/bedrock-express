/*!
 * Copyright (c) 2012-2021 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';

const {config} = bedrock;
const cc = bedrock.util.config.main.computer();

config.express = {};

// when true, only bind to the server using HTTP, not HTTPS
config.express.httpOnly = false;

// session info
config.express.session = {};
config.express.session.secret = '0123456789abcdef';
config.express.session.key = 'bedrock.sid';
config.express.session.prefix = 'bedrock.';
config.express.session.resave = true;
// sessions that have not been modified are not saved to the db
// until modified.
config.express.session.saveUninitialized = false;
config.express.session.cookie = {};
config.express.session.cookie.secure = true;
/* Note: Setting `maxAge` to `null` will instruct the browser to avoid
deleting it -- leaving all session management up to the server and the Web
application it serves. If it is not set to `null`, then either the cookie will
always be removed after some fixed period of time even when the user is active;
otherwise, the `Set-Cookie` header will have to be sent on every request in
order to advance `maxAge` to keep sessions open due to activity which creates
significant overhead and more session management and synchronization complexity
(between the server's session TTL and the client's cookie) that is usually not
worth the cost. */
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
config.express.staticOptions = {};
// make static options reuse `config.express.cache.maxAge`
cc('express.staticOptions.maxAge', () => config.express.cache.maxAge);

// use session support
config.express.useSession = false;

// errors
// `true` for full error output (HTML, etc)
// NOTE: `true` should only be used for *local* development purposes only, this
// setting causes stack traces to be included with all errors including
// NotAllowedError which is not appropriate for any public facing deployment
config.express.dumpExceptions = false;

// verbosity of JSON error logging
//   'none': no logging
//   'summary': log message, name, and HTTP status code if available
//   'full': log a serialize error object

// TODO: add mode to only log important server cause of exceptions
config.express.jsonErrorLevel = 'full';

// until the `cors` middleware helps address this; there's a new spec at:
// https://wicg.github.io/private-network-access/
// that has been implemented by Chrome that now prevents CORS from working
// when developing on localhost; this config option, by default, allows the
// previous behavior to continue when the bedrock server's host uses
// `localhost` in its name; to enable this new security feature on localhost,
// this config option has to be set to `false`
config.express.allowLocalhostCors = true;

/*
 * The Fastify module exports a factory function that is used to create new
 * Fastify server instances. This factory function accepts an options object
 * which is used to customize the resulting instance. This document describes
 * the properties available in that options object.
 *
 * https://www.fastify.io/docs/latest/Server/
 */
config.express.fastifyOptions = {};

// set `trustProxy` to `true` when the Bedrock application is running with
// `httpOnly = true` behind a load balancer that is doing TLS termination.
config.express.fastifyOptions.trustProxy = false;
