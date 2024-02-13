/*!
 * Copyright (c) 2022-2024 Digital Bazaar, Inc.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
import {config} from '@bedrock/core';
import '@bedrock/https-agent';
import {fileURLToPath} from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// set this to false to ignore SSL errors in development
config['https-agent'].rejectUnauthorized = false;

config.express.jsonErrorLevel = 'summary';

config.mocha.tests.push(path.join(__dirname, 'mocha'));
