/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

require('should');

let { captureStream, consoleSnapshot } = require('./LoggingGlobals');

let {
  checkForDeprecatedCallback,
} = require('../../src/WarningForCallbackHandlers.js');

let LogPatch = require('lambda-runtime/LogPatch');
const UserFunction = require('lambda-runtime/UserFunction.js');

const path = require('path');
const TEST_ROOT = path.join(__dirname, '../');
const HANDLERS_ROOT = path.join(TEST_ROOT, 'handlers');

describe('Formatted Error Logging', () => {
  let restoreConsole = consoleSnapshot();
  let capturedStdout = captureStream(process.stdout);

  beforeEach(
    'delete env var',
    () => delete process.env.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING,
  );
  beforeEach('capture stdout', () => capturedStdout.hook());
  beforeEach('apply console patch', () => LogPatch.patchConsole());
  afterEach('remove console patch', () => restoreConsole());
  afterEach('unhook stdout', () => capturedStdout.unhook());

  const expectedString =
    'AWS Lambda plans to remove support for callback-based function handlers';

  const tests = [
    { args: [false, 'isAsyncCallback.handler'], expected: true },
    { args: [true, 'isAsyncCallback.handler'], expected: false },
    { args: [false, 'isAsync.handlerAsync'], expected: false },
    { args: [true, 'isAsync.handlerAsync'], expected: false },
    { args: [false, 'defaultHandler.default'], expected: false },
    { args: [true, 'defaultHandler.default'], expected: false },
  ];

  tests.forEach(({ args, expected }) => {
    const shouldDeclareEnv = args[0];
    const handler = args[1];
    it(`When AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING=${shouldDeclareEnv} expecting ${
      expected ? 'no ' : ''
    }warning logs for handler ${handler}`, async () => {
      if (shouldDeclareEnv) {
        process.env.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING = 1;
      }
      const handlerFunc = await UserFunction.load(HANDLERS_ROOT, handler);
      const metadata = UserFunction.getHandlerMetadata(handlerFunc);

      checkForDeprecatedCallback(metadata);
      if (expected) {
        capturedStdout.captured().should.containEql(expectedString);
      } else {
        capturedStdout.captured().should.not.containEql(expectedString);
      }
    });
  });
});