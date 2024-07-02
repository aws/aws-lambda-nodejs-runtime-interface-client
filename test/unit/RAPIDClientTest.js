/**
 * Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

require('should');

let RAPIDClient = require('lambda-runtime/RAPIDClient.js');
let runtimeErrors = require('lambda-runtime/Errors.js');

/**
 * Stub request object.
 * Provides no-op definitions of the request functions used by the rapid client.
 */
const noOpRequest = Object.freeze({
  /* no op, return itself to allow continuations/chaining */
  on: () => noOpRequest,
  /* no op, return itself to allow continuations/chaining */
  end: () => noOpRequest,
});

class StubHttp {
  constructor() {
    this.lastUsedOptions = {};
    this.Agent = class FakeAgent {};
  }

  request(options, _callback) {
    this.lastUsedOptions = options;
    return noOpRequest;
  }
}

class NoOpNativeHttp {
  constructor() {
    this.lastRequestId = '';
    this.lastErrorRequestId = '';
  }

  done(requestId) {
    this.lastRequestId = requestId;
  }

  error(requestId) {
    this.lastErrorRequestId = requestId;
  }
}

class EvilError extends Error {
  get name() {
    throw 'gotcha';
  }
}

const EXPECTED_ERROR_HEADER = 'Lambda-Runtime-Function-Error-Type';

describe('building error requests with the RAPIDClient', () => {
  let stubHttp = new StubHttp();
  let client = new RAPIDClient('notUsed:1337', stubHttp, new NoOpNativeHttp());

  let errors = [
    [new Error('generic failure'), 'Error'],
    [new runtimeErrors.ImportModuleError(), 'Runtime.ImportModuleError'],
    [new runtimeErrors.HandlerNotFound(), 'Runtime.HandlerNotFound'],
    [new runtimeErrors.MalformedHandlerName(), 'Runtime.MalformedHandlerName'],
    [new runtimeErrors.UserCodeSyntaxError(), 'Runtime.UserCodeSyntaxError'],
    [{ data: 'some random object' }, 'object'],
    [new EvilError(), 'handled'],
  ];

  describe('the error header in postInitError', () => {
    errors.forEach(([error, name]) => {
      it(`should be ${name} for ${error.constructor.name}`, () => {
        client.postInitError(error);
        stubHttp.lastUsedOptions.should.have
          .property('headers')
          .have.property(EXPECTED_ERROR_HEADER, name);
      });
    });
  });
});

describe('invalid request id works', () => {
  const nativeClient = new NoOpNativeHttp();
  const client = new RAPIDClient('notUsed:1337', undefined, nativeClient);

  [
    // Encoding expected:
    ['#', '%23'],
    ['%', '%25'],
    ['/', '%2F'],
    ['?', '%3F'],
    ['\x7F', '%7F'],
    ["<script>alert('1')</script>", "%3Cscript%3Ealert('1')%3C%2Fscript%3E"],
    ['⚡', '%E2%9A%A1'],

    // No encoding:
    ['.', '.'],
    ['..', '..'],
    ['a', 'a'],
    [
      '59b22c65-fa81-47fb-a6dc-23028a63566f',
      '59b22c65-fa81-47fb-a6dc-23028a63566f',
    ],
  ].forEach(([requestId, expected]) => {
    it(`postInvocationResponse should encode requestId: '${requestId}'`, () => {
      client.postInvocationResponse({}, requestId, () => {});
      nativeClient.lastRequestId.should.be.equal(expected);
    });

    it(`postInvocationError should encode requestId: '${requestId}'`, () => {
      client.postInvocationError(new Error(), requestId, () => {});
      nativeClient.lastErrorRequestId.should.be.equal(expected);
    });
  });
});
