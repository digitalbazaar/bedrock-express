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

// unit tests for the express adapter's request-compat hook; these exercise the
// hook logic directly with fake req/reply objects so the http2 `headersSent`
// invariant (which the http1 integration suite cannot reach) is covered
import {
  _createFallbackRunner, expressifyRequest, register
} from '@bedrock/express/lib/expressAdapter.js';

// builds a minimal fake fastify request/reply pair mirroring what fastify
// passes to an onRequest hook
function makeReqReply({url = '/foo/a%2Fb', body, cookies} = {}) {
  const req = {
    id: 'req-1',
    hostname: 'example.test',
    ip: '127.0.0.1',
    ips: [],
    protocol: 'https',
    log: {},
    body,
    cookies,
    raw: {url, headers: {}}
  };
  const reply = {
    raw: {
      _headersSent: false,
      end() {
        this._headersSent = true;
      }
    },
    send() {
      this.raw.end();
    }
  };
  return {req, reply};
}

describe('express adapter (unit)', () => {
  it('should not define `headersSent` on reply.raw before send()', () => {
    const {req, reply} = makeReqReply();
    let nextCalled = false;
    expressifyRequest(req, reply, () => {
      nextCalled = true;
    });
    nextCalled.should.equal(true);
    // the mere presence of this property aborts http2 writeHead callers; it
    // must not exist until send() is invoked
    const has = Object.prototype.hasOwnProperty.call(reply.raw, 'headersSent');
    has.should.equal(false);
  });

  it('should leave req.raw.url untouched (no decode/normalize)', () => {
    const {req, reply} = makeReqReply({url: '/foo/a%2Fb'});
    expressifyRequest(req, reply, () => {});
    req.raw.url.should.equal('/foo/a%2Fb');
    req.raw.originalUrl.should.equal('/foo/a%2Fb');
  });

  it('should expose express-compat fields on req.raw', () => {
    const {req, reply} = makeReqReply();
    expressifyRequest(req, reply, () => {});
    req.raw.id.should.equal('req-1');
    req.raw.hostname.should.equal('example.test');
    req.raw.ip.should.equal('127.0.0.1');
    req.raw.protocol.should.equal('https');
  });

  it('should treat a second reply.raw.send() as a no-op', () => {
    const {req, reply} = makeReqReply();
    let sendCount = 0;
    reply.send = function() {
      sendCount++;
    };
    expressifyRequest(req, reply, () => {});
    reply.raw.send('a');
    reply.raw.send('b');
    sendCount.should.equal(1);
  });

  it('should define `headersSent` only after send() is called', () => {
    const {req, reply} = makeReqReply();
    expressifyRequest(req, reply, () => {});
    reply.raw.send('a');
    reply.raw.headersSent.should.equal(true);
  });

  it('should copy req.body onto req.raw (body-parser compat)', () => {
    const {req, reply} = makeReqReply({body: {a: 1}});
    expressifyRequest(req, reply, () => {});
    req.raw.body.should.deep.equal({a: 1});
  });

  it('should copy req.cookies onto req.raw (cookie-parser compat)', () => {
    const {req, reply} = makeReqReply({cookies: {sid: 'x'}});
    expressifyRequest(req, reply, () => {});
    req.raw.cookies.should.deep.equal({sid: 'x'});
  });
});

describe('express adapter (register)', () => {
  it('should throw if `expressApp` is not a function', () => {
    let err;
    try {
      register({addHook() {}}, {expressApp: {}});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.should.be.instanceof(TypeError);
  });
});

describe('express adapter fallback runner (unit)', () => {
  it('should defer to fastify when a route matched', () => {
    let appCalled = false;
    const run = _createFallbackRunner(() => {
      appCalled = true;
    });
    const req = {routeOptions: {url: '/matched'}, raw: {}};
    const reply = {raw: {}, getHeaders() {
      return {};
    }};
    let nextCalled = false;
    run(req, reply, () => {
      nextCalled = true;
    });
    nextCalled.should.equal(true);
    appCalled.should.equal(false);
  });

  it('should copy fastify-set headers onto reply.raw then run express', () => {
    let appCalled = false;
    const run = _createFallbackRunner((rawReq, rawRes, next) => {
      appCalled = true;
      next();
    });
    const setHeaders = {};
    const req = {routeOptions: {url: undefined}, raw: {}};
    const reply = {
      raw: {
        setHeader(name, value) {
          setHeaders[name] = value;
        }
      },
      getHeaders() {
        return {'x-test': 'yes'};
      }
    };
    run(req, reply, () => {});
    appCalled.should.equal(true);
    setHeaders['x-test'].should.equal('yes');
  });
});
