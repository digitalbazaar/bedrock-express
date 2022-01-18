/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {fastify, _setFastify} = require('bedrock-express');

describe('fastify', () => {
  before(() => {
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
