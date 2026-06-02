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
import {enhanceRequest} from '@bedrock/express/lib/express-adapter.js';

// builds a minimal fake fastify request/reply pair mirroring what fastify
// passes to an onRequest hook
function makeReqReply({url = '/foo/a%2Fb'} = {}) {
  const req = {
    id: 'req-1',
    hostname: 'example.test',
    ip: '127.0.0.1',
    ips: [],
    protocol: 'https',
    log: {},
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
    enhanceRequest(req, reply, () => {
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
    enhanceRequest(req, reply, () => {});
    req.raw.url.should.equal('/foo/a%2Fb');
    req.raw.originalUrl.should.equal('/foo/a%2Fb');
  });

  it('should expose express-compat fields on req.raw', () => {
    const {req, reply} = makeReqReply();
    enhanceRequest(req, reply, () => {});
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
    enhanceRequest(req, reply, () => {});
    reply.raw.send('a');
    reply.raw.send('b');
    sendCount.should.equal(1);
  });

  it('should define `headersSent` only after send() is called', () => {
    const {req, reply} = makeReqReply();
    enhanceRequest(req, reply, () => {});
    reply.raw.send('a');
    reply.raw.headersSent.should.equal(true);
  });
});
