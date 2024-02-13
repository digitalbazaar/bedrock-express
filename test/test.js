/*!
 * Copyright (c) 2022-2024 Digital Bazaar, Inc.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
import * as bedrock from '@bedrock/core';
import '@bedrock/https-agent';
import {fileURLToPath} from 'url';
import path from 'path';
import {asyncHandler, middleware} from '@bedrock/express';

const {acceptableContent} = middleware;
const {util: {BedrockError}} = bedrock;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

bedrock.events.on('bedrock-express.configure.static', () => {
  bedrock.config.express.static.push({
    route: '/static/foo',
    path: path.join(__dirname, 'static', 'foo.html'),
    file: true,
    cors: true,
  });
  bedrock.config.express.static.push({
    route: '/static',
    path: path.join(__dirname, 'static'),
    cors: {
      exposedHeaders: ['Date', 'Location', 'Content-Length']
    },
  });
  bedrock.config.express.static.push({
    route: '/static',
    path: path.join(__dirname, 'static', 'baz.html'),
    cors: {
      exposedHeaders: ['Date', 'Location', 'Content-Length']
    },
  });
  bedrock.config.express.static.push(
    path.join(__dirname, 'static'));
});

bedrock.events.on('bedrock-express.configure.routes', app => {
  app.get('/test', asyncHandler(async (req, res) => {
    res.json({success: true});
  }));
  // eslint-disable-next-line no-unused-vars
  app.get('/permission-denied-error', asyncHandler(async (req, res) => {
    throw new BedrockError('Permission denied.', 'PermissionDenied', {
      public: true,
      httpStatusCode: 403,
    });
  }));
  // eslint-disable-next-line no-unused-vars
  app.get('/not-found-error', asyncHandler(async (req, res) => {
    throw new BedrockError('Not Found.', 'NotFound', {
      public: true,
    });
  }));
  // eslint-disable-next-line no-unused-vars
  app.get('/non-bedrock-error', asyncHandler(async (req, res) => {
    throw new Error('non-bedrock error.');
  }));
  // eslint-disable-next-line no-unused-vars
  app.get('/unhandled-error', asyncHandler(async (req, res) => {
    const err = new BedrockError('Not Found.', 'NotFound', {
      public: true,
    });
    err.status = 404;
    throw err;
  }));
  app.post('/acceptable-content',
    acceptableContent('json', '+json'),
    asyncHandler(async (req, res) => {
      res.json({success: true});
    }));
  app.post('/acceptable-content-string-options',
    acceptableContent('json'),
    asyncHandler(async (req, res) => {
      res.json({success: true});
    }));
  app.post('/acceptable-content-array-options',
    acceptableContent(['json', '+json']),
    asyncHandler(async (req, res) => {
      res.json({success: true});
    }));
});

import '@bedrock/test';
bedrock.start();
