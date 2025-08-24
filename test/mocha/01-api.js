/*!
 * Copyright 2022 - 2024 Digital Bazaar, Inc.
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
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {httpClient} from '@digitalbazaar/http-client';
import path from 'node:path';

const {readFile} = fs.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('configured routes', () => {
  const BASE_URL = `https://localhost:18443`;
  it('should return 200 status code', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/test`, {agent});
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should return 403 status code', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/permission-denied-error`,
        {agent});
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(403);
    err.message.should.equal('Permission denied.');
  });
  it('should return 404 status code', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/not-found-error`, {agent});
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(404);
    err.message.should.include('Not Found');
    err.response.headers.get('content-type')
      .should.equal('application/json; charset=utf-8');
  });
  it('should return 500 status code', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/non-bedrock-error`, {agent});
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(500);
  });
  it('should handle "text/html" accept header', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/unhandled-error`, {
        agent,
        headers: {
          Accept: 'text/html'
        }
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(404);
    err.message.should.include('Not Found');
    err.response.headers.get('content-type')
      .should.equal('text/plain');
  });
  it('should serve a static file property with file and cors', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/static/foo`, {
        agent,
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    const body = await res.text();
    const filepath = path.join(__dirname, '..', 'static', 'foo.html');
    const content = await readFile(filepath, 'utf-8');
    body.should.equal(content);
  });

  it('should serve a static files in a directory with given paths',
    async () => {
      let res;
      let err;
      try {
        res = await httpClient.get(`${BASE_URL}/static/bar.html`, {
          agent,
        });
      } catch(e) {
        err = e;
      }
      should.exist(res);
      should.not.exist(err);
      res.status.should.equal(200);
      const body = await res.text();
      const filepath = path.join(__dirname, '..', 'static', 'bar.html');
      const content = await readFile(filepath, 'utf-8');
      body.should.equal(content);
    });

  it('should serve a static files without given route on root',
    async () => {
      let res;
      let err;
      try {
        res = await httpClient.get(`${BASE_URL}/bar.html`, {
          agent,
        });
      } catch(e) {
        err = e;
      }
      should.exist(res);
      should.not.exist(err);
      res.status.should.equal(200);
      const body = await res.text();
      const filepath = path.join(__dirname, '..', 'static', 'bar.html');
      const content = await readFile(filepath, 'utf-8');
      body.should.equal(content);
    });

  it('should return 404 if static file is not found', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/baz.html`, {
        agent,
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(404);
    err.message.should.include('Route GET:/baz.html not found');
  });

  it('should return 404 if non root static file is not found ', async () => {
    let res;
    let err;
    try {
      res = await httpClient.get(`${BASE_URL}/static/baz.html`, {
        agent,
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(404);
    err.message.should.include('Route GET:/static/baz.html not found');
  });
  it('should respond with success if content type is acceptable when ' +
    'passing multiple arguments to acceptableContent', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/acceptable-content`, {
        agent,
        headers: {
          ['content-type']: 'application/json'
        }
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with success if content type is acceptable when ' +
    'passing options of type string to acceptableContent', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(
        `${BASE_URL}/acceptable-content-string-options`, {
          agent,
          headers: {
            ['content-type']: 'application/json'
          }
        });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with success if content type is acceptable when ' +
    'passing options of type array to acceptableContent', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(
        `${BASE_URL}/acceptable-content-array-options`, {
          agent,
          headers: {
            ['content-type']: 'application/json'
          }
        });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with error if content type is not acceptable',
    async () => {
      let res;
      let err;
      try {
        res = await httpClient.post(`${BASE_URL}/acceptable-content`, {
          agent,
          headers: {
            ['content-type']: 'text/html'
          }
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(res);
      should.exist(err);
      err.status.should.equal(415);
      err.message.should.include('Unsupported Media Type');
    });
  it('should respond with success if content <= 1b', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/json-size-limit/1b`, {
        agent,
        json: 1
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with error if content > 1b', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/json-size-limit/1b`, {
        agent,
        json: {}
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(413);
    err.message.should.include('Content is too large');
  });
  it('should respond with success if content <= 100b', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/json-size-limit/100b`, {
        agent,
        json: {}
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with error if content > 100b', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/json-size-limit/100b`, {
        agent,
        json: 'a'.repeat(99)
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(413);
    err.message.should.include('Content is too large');
  });
  it('should respond with success if content <= 101kb', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/json-size-limit/101kb`, {
        agent,
        // subtract 2 for double quote chars
        json: 'a'.repeat(101 * 1024 - 2)
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with error if content > 101kb', async () => {
    let res;
    let err;
    try {
      res = await httpClient.post(`${BASE_URL}/json-size-limit/101kb`, {
        agent,
        // 2 double quote chars will put this over the limit
        json: 'a'.repeat(101 * 1024)
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(413);
    err.message.should.include('Content is too large');
  });
  it('should respond with success if content <= 100kb w/path', async () => {
    let res;
    let err;
    try {
      const url = `${BASE_URL}/json-size-limit/any/100kb/some/path`;
      res = await httpClient.post(url, {
        agent,
        // subtract 2 for double quote chars
        json: 'a'.repeat(100 * 1024 - 2)
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with error if content > 100kb w/path', async () => {
    let res;
    let err;
    try {
      const url = `${BASE_URL}/json-size-limit/any/100kb/some/path`;
      res = await httpClient.post(url, {
        agent,
        // 2 double quote chars will put this over the limit
        json: 'a'.repeat(100 * 1024)
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(413);
    err.message.should.include('Content is too large');
  });
  it('should respond with success if content <= 101kb w/path', async () => {
    let res;
    let err;
    try {
      const url = `${BASE_URL}/json-size-limit/any/101kb/some/path`;
      res = await httpClient.post(url, {
        agent,
        // subtract 2 for double quote chars
        json: 'a'.repeat(101 * 1024 - 2)
      });
    } catch(e) {
      err = e;
    }
    should.exist(res);
    should.not.exist(err);
    res.status.should.equal(200);
    res.data.success.should.equal(true);
  });
  it('should respond with error if content > 101kb w/path', async () => {
    let res;
    let err;
    try {
      const url = `${BASE_URL}/json-size-limit/any/101kb/some/path`;
      res = await httpClient.post(url, {
        agent,
        // 2 double quote chars will put this over the limit
        json: 'a'.repeat(101 * 1024)
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(res);
    should.exist(err);
    err.status.should.equal(413);
    err.message.should.include('Content is too large');
  });
});
