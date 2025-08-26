/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

'use strict';

require('should');
const path = require('path');
const UserFunction = require('lambda-runtime/UserFunction.js');

const TEST_ROOT = path.join(__dirname, '../');
const HANDLERS_ROOT = path.join(TEST_ROOT, 'handlers');

describe('isAsync tests', () => {
  it('is async should be true', async () => {
    const handlerFunc = await UserFunction.load(
      HANDLERS_ROOT,
      'isAsync.handlerAsync',
    );
    const metadata = UserFunction.getHandlerMetadata(handlerFunc);
    metadata.isAsync.should.be.true();
  });
  it('is async should be false', async () => {
    const handlerFunc = await UserFunction.load(
      HANDLERS_ROOT,
      'isAsync.handlerNotAsync',
    );
    const metadata = UserFunction.getHandlerMetadata(handlerFunc);
    metadata.isAsync.should.be.false();
  });
  it('is async should be false since it is a callback', async () => {
    const handlerFunc = await UserFunction.load(
      HANDLERS_ROOT,
      'isAsyncCallback.handler',
    );
    const metadata = UserFunction.getHandlerMetadata(handlerFunc);
    metadata.isAsync.should.be.false();
  });
});