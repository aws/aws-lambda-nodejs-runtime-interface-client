/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

require('should');
const sleep = require('util').promisify(setTimeout);

let InvokeContext = require('lambda-runtime/InvokeContext');

describe('Getting remaining invoke time', () => {
  it('should reduce by at least elapsed time', async () => {
    let ctx = new InvokeContext({
      'lambda-runtime-deadline-ms': Date.now() + 1000,
    });

    const timeout = 100;
    let before = ctx._headerData().getRemainingTimeInMillis();
    await sleep(timeout + 10);
    let after = ctx._headerData().getRemainingTimeInMillis();
    (before - after).should.greaterThanOrEqual(
      timeout - 1 /* Timers are not precise, allow 1 ms drift */,
    );
  });

  it('should be within range', () => {
    let ctx = new InvokeContext({
      'lambda-runtime-deadline-ms': Date.now() + 1000,
    });

    let remainingTime = ctx._headerData().getRemainingTimeInMillis();

    remainingTime.should.greaterThan(0);
    remainingTime.should.lessThanOrEqual(1000);
  });
});

describe('Verifying tenant id', () => {
  it('should return undefined if tenant id is not set', () => {
    let ctx = new InvokeContext({});

    (ctx._headerData().tenantId === undefined).should.be.true();
  });
  it('should return undefined if tenant id is set to undefined', () => {
    let ctx = new InvokeContext({
      'lambda-runtime-aws-tenant-id': undefined,
    });

    (ctx._headerData().tenantId === undefined).should.be.true();
  });
  it('should return empty if tenant id is set to empty string', () => {
    let ctx = new InvokeContext({
      'lambda-runtime-aws-tenant-id': '',
    });

    (ctx._headerData().tenantId === '').should.be.true();
  });
  it('should return the same id if a valid tenant id is set', () => {
    let ctx = new InvokeContext({
      'lambda-runtime-aws-tenant-id': 'blue',
    });

    ctx._headerData().tenantId.should.equal('blue');
  });
});
