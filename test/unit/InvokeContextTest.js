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
