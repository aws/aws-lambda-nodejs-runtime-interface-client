/**
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

require('should');
const StreamingContext = require('../../src/StreamingContext.js');
const { PassThrough } = require('stream');
const BeforeExitListener = require('../../src/BeforeExitListener.js');

class MockRapidClient {
  constructor() {
    this.sentErrors = [];
    this.responseStream = new PassThrough();
    this.responseStream.fail = (err, callback) => {
      this.sentErrors.push({ err });
      callback();
    };
  }

  getStreamForInvocationResponse() {
    return { request: this.responseStream, responseDone: undefined };
  }
}

describe('StreamingContext', () => {
  it('can set callbackWaitsForEmptyEventLoop', () => {
    const ctx = StreamingContext.build();

    ctx.callbackWaitsForEmptyEventLoop = true;
    ctx.callbackWaitsForEmptyEventLoop.should.be.equal(true);

    ctx.callbackWaitsForEmptyEventLoop = false;
    ctx.callbackWaitsForEmptyEventLoop.should.be.equal(false);
  });

  it('can create stream', () => {
    const id = '12-3-4-56';
    const client = new MockRapidClient();
    const ctx = StreamingContext.build(
      client,
      id,
      () => {},
      JSON.stringify({}),
    );
    const stream = ctx.createStream();
    should(stream).not.be.empty();
  });

  it('cannot create stream more than once', () => {
    const id = '12-3-4-56';
    const client = new MockRapidClient();
    const ctx = StreamingContext.build(
      client,
      id,
      () => {},
      JSON.stringify({}),
    );
    const stream = ctx.createStream();
    should(stream).not.be.empty();

    for (let i = 0; i < 5; i++) {
      should(() => ctx.createStream()).throw({
        message:
          'Cannot create stream for the same StreamingContext more than once.',
      });
    }
  });

  [true, false].forEach((callbackWaitsForEmptyEventLoop) =>
    [
      {
        error: new Error('too much sun'),
        expected: 'too much sun',
      },
      {
        error: 'too much sun',
        expected: 'too much sun',
      },
    ].forEach((v) =>
      it(`can call next after fail (callbackWaitsForEmptyEventLoop: ${callbackWaitsForEmptyEventLoop}, error: ${typeof v.error})`, () => {
        // This test will print "Invoke Error" to stderr which is to be expected.

        let nextCalled = 0;
        const ID = '12-3-4-56';
        const client = new MockRapidClient();
        const ctx = StreamingContext.build(
          client,
          ID,
          () => nextCalled++,
          JSON.stringify({}),
        );
        ctx.callbackWaitsForEmptyEventLoop = callbackWaitsForEmptyEventLoop;
        const { scheduleNext, fail } = ctx.createStream();

        fail(v.error, scheduleNext);
        client.responseStream.fail(v.error, scheduleNext);

        const verify = () => {
          nextCalled.should.be.equal(1);

          console.log('client.sentErrors', client.sentErrors);
          console.log('client.invocationErrors', client.invocationErrors);

          client.sentErrors.length.should.be.equal(1);
          if (typeof v.error === 'string') {
            client.sentErrors[0].err.should.be.equal(v.expected);
          } else {
            client.sentErrors[0].err.message.should.be.equal(v.expected);
          }
        };

        if (v) {
          BeforeExitListener.invoke();
          setImmediate(() => verify());
        } else {
          verify();
        }
      }),
    ),
  );
});
