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

import {fastify, _setFastify} from '@bedrock/express';

describe('fastify', () => {
  before(() => {
    // Set fastify to null
    _setFastify({fastify: null});
  });
  it('should throw error if fastify is null when getting prototype', () => {
    _assertInvalidStateError(() => {
      Object.getPrototypeOf(fastify);
    });
  });
  it('should throw error if fastify is null when getting property descriptor',
    () => {
      _assertInvalidStateError(() => {
        Object.getOwnPropertyDescriptor(fastify, 'addSchema');
      });
    });
  it('should throw error if fastify is null when getting property value',
    () => {
      _assertInvalidStateError(() => {
        fastify.addSchema;
      });
    });
  it('should throw error if fastify is null when setting property value',
    () => {
      _assertInvalidStateError(() => {
        fastify.addSchema = () => {};
      });
    });
});

function _assertInvalidStateError(fn) {
  let err;
  try {
    fn();
  } catch(error) {
    err = error;
  }
  should.exist(err);
  err.name.should.equal('InvalidStateError');
  err.message.should.equal('Fastify is not ready.');
}
