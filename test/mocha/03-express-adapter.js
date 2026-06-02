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

import {agent} from '@bedrock/https-agent';
import {httpClient} from '@digitalbazaar/http-client';

const BASE_URL = 'https://localhost:18443';

describe('express adapter', () => {
  describe('URL handling', () => {
    it('should preserve an encoded path parameter', async () => {
      // `a%2Fb` must be delivered to express as the param value `a/b`; the
      // adapter must NOT eagerly decode `req.url` (which would corrupt the
      // path and split the segment)
      let res;
      let err;
      try {
        res = await httpClient.get(`${BASE_URL}/encoded-param/a%2Fb`, {agent});
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(res);
      res.status.should.equal(200);
      res.data.id.should.equal('a/b');
    });
    it('should not decode the raw request url', async () => {
      // `req.url` must remain encoded exactly as received; decoding it is the
      // upstream bug that breaks encoded path params and enables the bogus
      // "encoding bypass" reasoning
      let res;
      let err;
      try {
        res = await httpClient.get(
          `${BASE_URL}/encoded-param/a%2Fb`, {agent});
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(res);
      res.data.url.should.include('a%2Fb');
      res.data.url.should.not.include('a/b');
    });
    it('should preserve a double-encoded path parameter', async () => {
      // double-encoding must not be silently collapsed; the app sees exactly
      // what the client sent (`%252F` decodes once to the literal `%2F`)
      let res;
      let err;
      try {
        res = await httpClient.get(
          `${BASE_URL}/encoded-param/a%252Fb`, {agent});
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(res);
      res.status.should.equal(200);
      res.data.id.should.equal('a%2Fb');
    });
  });

  describe('response behavior', () => {
    it('should treat a second res.send() as a no-op', async () => {
      // calling send() twice must not throw or corrupt the response; only the
      // first body is returned
      let res;
      let err;
      try {
        res = await httpClient.get(`${BASE_URL}/double-send`, {agent});
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(res);
      res.status.should.equal(200);
      res.data.order.should.equal('first');
    });
  });
});
