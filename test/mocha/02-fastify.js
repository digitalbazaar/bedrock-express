/*!
 * Copyright (c) 2022-2024 Digital Bazaar, Inc.
 *
 * SPDX-License-Identifier: BSD-3-Clause
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
