/*!
 * Copyright 2026 Digital Bazaar, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* This is a minimal adapter for running an Express application inside Fastify
as the fallback handler for any request that no Fastify route claims. It
replaces `@fastify/express`, which is no longer used. It intentionally does
*not* decode or normalize the request URL (encoding is not a security boundary
and decoding corrupts encoded path parameters) and does *not* add a
`headersSent` property to the raw response until `send()` is called (the mere
presence of that property aborts callers of the http2 `writeHead`). */

/**
 * Registers the Express adapter on a Fastify instance. Adds the request
 * compatibility hook and the fallback runner that invokes the Express app
 * when no Fastify route matches.
 *
 * @param {object} fastify - The Fastify instance.
 * @param {object} options - The options to use.
 * @param {Function} options.expressApp - The Express application to run as the
 *   fallback handler.
 */
export function register(fastify, {expressApp} = {}) {
  if(typeof expressApp !== 'function') {
    throw new TypeError('"expressApp" must be an Express application.');
  }
  fastify.addHook('onRequest', enhanceRequest);
  fastify.addHook('onRequest', createFallbackRunner(expressApp));
}

/**
 * Fastify `onRequest` hook that augments the raw Node request/response so that
 * Express middleware works, without mangling the URL or eagerly defining
 * `headersSent`.
 *
 * @param {object} req - The Fastify request.
 * @param {object} reply - The Fastify reply.
 * @param {Function} next - The callback to continue request handling.
 */
export function enhanceRequest(req, reply, next) {
  const {raw} = req;

  // leave `raw.url` exactly as received (no `decodeURI`, no normalize) so that
  // encoded path parameters survive; expose `originalUrl` for parity with
  // Express conventions
  raw.originalUrl = raw.url;
  raw.id = req.id;
  raw.hostname = req.hostname;
  raw.ip = req.ip;
  raw.ips = req.ips;
  raw.log = req.log;
  reply.raw.log = req.log;

  // `protocol` delegates to the Fastify-parsed value
  Object.defineProperty(raw, 'protocol', {
    get() {
      return req.protocol;
    },
    configurable: true,
    enumerable: true
  });

  // backward compatibility for body-parser
  if(req.body) {
    raw.body = req.body;
  }
  // backward compatibility for cookie-parser
  if(req.cookies) {
    raw.cookies = req.cookies;
  }

  // guard against a double `send()`; define `headersSent` *only* once `send()`
  // has been called, never before
  let replySent = false;
  reply.raw.send = function send(...args) {
    if(replySent) {
      return;
    }
    replySent = true;
    Object.defineProperty(reply.raw, 'headersSent', {
      get() {
        return replySent;
      },
      configurable: true,
      enumerable: true
    });
    return reply.send.apply(reply, args);
  };

  next();
}

/**
 * Creates the Fastify `onRequest` hook that runs the Express app as a fallback
 * when no Fastify route matched the request.
 *
 * @param {Function} expressApp - The Express application to invoke.
 *
 * @returns {Function} The `onRequest` hook.
 */
export function createFallbackRunner(expressApp) {
  return function runExpressFallback(req, reply, next) {
    // only run Express when no Fastify route has been defined to handle the
    // request; otherwise let Fastify handle it
    if(req.routeOptions.url !== undefined) {
      return next();
    }
    // copy any headers Fastify has already set onto the raw response so the
    // Express app emits them
    for(const [name, value] of Object.entries(reply.getHeaders())) {
      reply.raw.setHeader(name, value);
    }
    expressApp(req.raw, reply.raw, next);
  };
}
