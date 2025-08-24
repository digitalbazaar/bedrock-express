/*!
 * Copyright 2022 - 2025 Digital Bazaar, Inc.
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
import {config} from '@bedrock/core';
import {fileURLToPath} from 'url';
import path from 'path';
import '@bedrock/https-agent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// set this to false to ignore SSL errors in development
config['https-agent'].rejectUnauthorized = false;

config.express.jsonErrorLevel = 'summary';

// test JSON parsing limits
config.express.bodyParser.routes['/json-size-limit/1b'] = {
  strict: false,
  limit: '1b',
  type: ['json', '+json']
};
config.express.bodyParser.routes['/json-size-limit/100b'] = {
  strict: false,
  limit: '100b',
  type: ['json', '+json']
};
config.express.bodyParser.routes['/json-size-limit/101kb'] = {
  strict: false,
  limit: '101kb',
  type: ['json', '+json']
};
config.express.bodyParser.routes['/json-size-limit/any/101kb/*'] = {
  strict: false,
  limit: '101kb',
  type: ['json', '+json']
};

config.mocha.tests.push(path.join(__dirname, 'mocha'));
