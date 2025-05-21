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

class MockNativeClient {
  constructor(response) {
    this.response = response;
    this.called = false;
    this.shouldThrowError = false;
  }

  next() {
    this.called = true;
    if (this.shouldThrowError) {
      return Promise.reject(new Error('Failed to get next invocation'));
    } else {
      return Promise.resolve(this.response);
    }
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

describe('next invocation with native client works', () => {
  it('should call the native client next() method', async () => {
    const mockNative = new MockNativeClient({
      bodyJson: '',
      headers: {
        'lambda-runtime-aws-request-id': 'test-request-id',
      },
    });
    const client = new RAPIDClient('notUsed:1337', undefined, mockNative);
    client.useAlternativeClient = false;

    await client.nextInvocation();
    // verify native client was called
    mockNative.called.should.be.true();
  });
  it('should parse all required headers', async () => {
    const mockResponse = {
      bodyJson: '{"message":"Hello from Lambda!"}',
      headers: {
        'lambda-runtime-aws-request-id': 'test-request-id',
        'lambda-runtime-deadline-ms': 1619712000000,
        'lambda-runtime-trace-id': 'test-trace-id',
        'lambda-runtime-invoked-function-arn': 'test-function-arn',
        'lambda-runtime-client-context': '{"client":{"app_title":"MyApp"}}',
        'lambda-runtime-cognito-identity':
          '{"identityId":"id123","identityPoolId":"pool123"}',
        'lambda-runtime-aws-tenant-id': 'test-tenant-id',
      },
    };

    const mockNative = new MockNativeClient(mockResponse);
    const client = new RAPIDClient('notUsed:1337', undefined, mockNative);

    client.useAlternativeClient = false;
    const response = await client.nextInvocation();

    // Verify all headers are present
    response.headers.should.have.property(
      'lambda-runtime-aws-request-id',
      'test-request-id',
    );
    response.headers.should.have.property(
      'lambda-runtime-deadline-ms',
      1619712000000,
    );
    response.headers.should.have.property(
      'lambda-runtime-trace-id',
      'test-trace-id',
    );
    response.headers.should.have.property(
      'lambda-runtime-invoked-function-arn',
      'test-function-arn',
    );
    response.headers.should.have.property(
      'lambda-runtime-client-context',
      '{"client":{"app_title":"MyApp"}}',
    );
    response.headers.should.have.property(
      'lambda-runtime-cognito-identity',
      '{"identityId":"id123","identityPoolId":"pool123"}',
    );
    response.headers.should.have.property(
      'lambda-runtime-aws-tenant-id',
      'test-tenant-id',
    );
    // Verify body is correctly passed through
    response.bodyJson.should.equal('{"message":"Hello from Lambda!"}');
  });
  it('should handle native client errors', async () => {
    const nativeClient = new MockNativeClient({});
    nativeClient.shouldThrowError = true;

    const client = new RAPIDClient('localhost:8080', null, nativeClient);
    client.useAlternativeClient = false;

    await client.nextInvocation().should.be.rejectedWith('Failed to get next invocation');
  });
});
