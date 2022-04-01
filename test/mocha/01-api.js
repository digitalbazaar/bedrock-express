/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {agent} from '@bedrock/https-agent';
import {createRequire} from 'module';
import {fileURLToPath} from 'url';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const {httpClient} = require('@digitalbazaar/http-client');

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
    err.message.should.equal('Not Found.');
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
    err.message.should.equal('Not Found');
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
    err.message.should.equal('Route GET:/baz.html not found');
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
    err.message.should.equal('Route GET:/static/baz.html not found');
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
      err.message.should.equal('Unsupported Media Type');
    });
});
