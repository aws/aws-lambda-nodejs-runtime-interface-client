/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const util = require('util');

let should = require('should');
let LogPatch = require('lambda-runtime/LogPatch');
let Errors = require('lambda-runtime/Errors');
let assert = require('assert');

let {
  captureStream,
  consoleSnapshot,
  loggingConfig,
} = require('./LoggingGlobals');
let FakeTelemetryTarget = require('./FakeTelemetryTarget');
let fakeLoggingConfig = new loggingConfig();
const logFunctions = [
  [
    function (message, ...params) {
      console.trace(message, ...params);
    },
    'TRACE',
  ],
  [
    function (message, ...params) {
      console.debug(message, ...params);
    },
    'DEBUG',
  ],
  [
    function (message, ...params) {
      console.info(message, ...params);
    },
    'INFO',
  ],
  [
    function (message, ...params) {
      console.log(message, ...params);
    },
    'INFO',
  ],
  [
    function (message, ...params) {
      console.warn(message, ...params);
    },
    'WARN',
  ],
  [
    function (message, ...params) {
      console.error(message, ...params);
    },
    'ERROR',
  ],
  [
    function (message, ...params) {
      console.fatal(message, ...params);
    },
    'FATAL',
  ],
];

describe('Apply the default console log patch', () => {
  let restoreConsole = consoleSnapshot();
  let capturedStdout = captureStream(process.stdout);

  beforeEach('capture stdout', () => capturedStdout.hook());
  beforeEach('apply console patch', () => LogPatch.patchConsole());
  afterEach('remove console patch', () => restoreConsole());
  afterEach('unhook stdout', () => capturedStdout.unhook());

  it('should have four tab-separated fields on a normal line', () => {
    console.log('anything');
    capturedStdout.captured().should.match(/.*\t.*\t.*\t.*\n/);
  });

  it('should have five tab-separated fields when logging an error', () => {
    console.error('message', Errors.toFormatted(new Error('garbage')));
    capturedStdout.captured().should.match(/.*\t.*\t.*\t.*\t.*\n/);
  });

  describe('When the global requestId is set', () => {
    const EXPECTED_ID = 'some fake request id';

    beforeEach('set the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });
    afterEach('unset the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });

    it('should include the requestId as the second field', () => {
      console.info('something');
      capturedStdout
        .captured()
        .should.match(new RegExp(`.*\t${EXPECTED_ID}\t.*\t.*\n`));
    });
  });

  it('should include the level field as the third field', () => {
    console.warn('content');
    capturedStdout.captured().should.match(new RegExp(`.*\t.*\tWARN\t.*\n`));
  });

  it('should include the message as the fourth field', () => {
    let message = 'my turbo message';
    console.trace(message);
    capturedStdout
      .captured()
      .should.match(new RegExp(`.*\t.*\t.*\t${message}\n`));
  });

  describe('Each console.* method should include a level value', () => {
    it('should use INFO for console.log', () => {
      console.log('hello');
      capturedStdout.captured().should.containEql('INFO');
    });

    it('should use INFO for console.info', () => {
      console.info('hello');
      capturedStdout.captured().should.containEql('INFO');
    });

    it('should use WARN for console.warn', () => {
      console.warn('hello');
      capturedStdout.captured().should.containEql('WARN');
    });

    it('should use ERROR for console.error', () => {
      console.error('hello');
      capturedStdout.captured().should.containEql('ERROR');
    });

    it('should use TRACE for console.trace', () => {
      console.trace('hello');
      capturedStdout.captured().should.containEql('TRACE');
    });

    it('should use FATAL for console.fatal', () => {
      console.fatal('hello');
      capturedStdout.captured().should.containEql('FATAL');
    });
  });

  it('should log an error as json', () => {
    let expected = new Error('some error');
    expected.code = 1234;
    expected.custom = 'my custom field';

    console.error('message', Errors.toFormatted(expected));

    let errorString = capturedStdout.captured().split('\t')[4];
    let recoveredError = JSON.parse(errorString);

    recoveredError.should.have.property('errorType', expected.name);
    recoveredError.should.have.property('errorMessage', expected.message);
    recoveredError.should.have.property('stack', expected.stack.split('\n'));
    recoveredError.should.have.property('code', expected.code);
    recoveredError.should.have.property('custom', expected.custom);
  });

  describe('Structured logging for new line delimited logs', () => {
    const EXPECTED_ID = 'structured logging for nd logging request id';
    beforeEach('set the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });

    beforeEach('turn on structured logging', () => {
      fakeLoggingConfig.turnOnStructuredLogging();
      LogPatch.patchConsole();
    });
    afterEach('turn off structured logging', () => {
      fakeLoggingConfig.turnOffStructuredLogging();
    });

    it('should format messages as json correctly', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        logFunctions[fIdx][0]('hello structured logging');
        let receivedMessage = capturedStdout.captured();
        receivedMessage = JSON.parse(receivedMessage);

        receivedMessage.should.have.property('timestamp');
        let receivedTime = new Date(receivedMessage.timestamp);
        let now = new Date();
        assert(now >= receivedTime && now - receivedTime <= 1000);

        receivedMessage.should.have.property(
          'message',
          'hello structured logging',
        );
        receivedMessage.should.have.property('level', logFunctions[fIdx][1]);
        receivedMessage.should.have.property('requestId', EXPECTED_ID);

        capturedStdout.resetBuffer();
      }
    });
  });
  describe(' `structuredConsole.logError()` method in TEXT mode', () => {
    const EXPECTED_ID = 'structured logging request id';
    const originalDate = Date;
    beforeEach('set the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });
    beforeEach('freeze current date', () => {
      function mockDate() {
        return new originalDate('2023-09-25T12:00:00Z');
      }
      global.Date = mockDate;
    });
    afterEach('unfreeze current date', () => {
      global.Date = originalDate;
    });
    it('should produce stringified output for TEXT mode', () => {
      let expected = new Error('some error');
      expected.code = 1234;
      expected.custom = 'my custom field';
      LogPatch.structuredConsole.logError('Invocation Error', expected);

      let recoveredMessage = capturedStdout.captured().split('\t');
      recoveredMessage[2].should.be.equal('ERROR');
      recoveredMessage[3].should.be.equal('Invocation Error ');

      let recoveredError = JSON.parse(recoveredMessage[4]);
      recoveredError.should.have.property('errorType', expected.name);
      recoveredError.should.have.property('errorMessage', expected.message);
      recoveredError.should.have.property('stack', expected.stack.split('\n'));
      recoveredError.should.have.property('code', expected.code);
      recoveredError.should.have.property('custom', expected.custom);
    });
  });
});

describe('The multiline log patch', () => {
  let restoreConsole = consoleSnapshot();
  let telemetryTarget = new FakeTelemetryTarget();

  beforeEach('create a new telemetry file and patch the console', () => {
    telemetryTarget.openFile();
    telemetryTarget.updateEnv();
    LogPatch.patchConsole();
  });
  afterEach('close the telemetry file and unpatch the console', () => {
    restoreConsole();
    telemetryTarget.closeFile();
  });

  it('should clear the telemetry env var', () => {
    should.not.exist(process.env['_LAMBDA_TELEMETRY_LOG_FD']);
  });

  it('should write a line', () => {
    console.log('a line');
    telemetryTarget.readLine().should.containEql('a line');
  });

  it('should have four tab-separated fields on a normal line', () => {
    console.log('anything');
    telemetryTarget.readLine().should.match(/.*\t.*\t.*\t.*/);
  });

  it('should end with a newline', () => {
    console.log('lol');
    telemetryTarget.readLine().should.match(/.*\n$/);
  });

  it('should have five tab-separated fields when logging an error', () => {
    console.error('message', Errors.toFormatted(new Error('garbage')));
    telemetryTarget.readLine('ERROR').should.match(/.*\t.*\t.*\t.*\t.*/);
  });

  describe('When the global requestId is set', () => {
    const EXPECTED_ID = 'some fake request id';

    beforeEach('set the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });
    afterEach('unset the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });

    it('should include the requestId as the second field', () => {
      console.info('something');
      telemetryTarget
        .readLine()
        .should.match(new RegExp(`.*\t${EXPECTED_ID}\t.*\t.*`));
    });
  });

  it('should include the level field as the third field', () => {
    console.warn('content');
    telemetryTarget
      .readLine('WARN')
      .should.match(new RegExp(`.*\t.*\tWARN\t.*`));
  });

  it('should include the message as the fourth field', () => {
    let message = 'my turbo message';
    console.trace(message);
    telemetryTarget
      .readLine('TRACE')
      .should.match(new RegExp(`.*\t.*\t.*\t${message}`));
  });

  describe('Each console.* method should include a level value', () => {
    it('should use INFO for console.log', () => {
      console.log('hello');
      telemetryTarget.readLine().should.containEql('INFO');
    });

    it('should use INFO for console.info', () => {
      console.info('hello');
      telemetryTarget.readLine().should.containEql('INFO');
    });

    it('should use WARN for console.warn', () => {
      console.warn('hello');
      telemetryTarget.readLine('WARN').should.containEql('WARN');
    });

    it('should use ERROR for console.error', () => {
      console.error('hello');
      telemetryTarget.readLine('ERROR').should.containEql('ERROR');
    });

    it('should use TRACE for console.trace', () => {
      console.trace('hello');
      telemetryTarget.readLine('TRACE').should.containEql('TRACE');
    });

    it('should use FATAL for console.fatal', () => {
      console.fatal('hello');
      telemetryTarget.readLine('FATAL').should.containEql('FATAL');
    });
  });

  it('should log an error as json', () => {
    let expected = new Error('some error');
    expected.code = 1234;
    expected.custom = 'my custom field';

    console.error('message', Errors.toFormatted(expected));

    let errorString = telemetryTarget.readLine('ERROR').split('\t')[4];
    let recoveredError = JSON.parse(errorString);

    recoveredError.should.have.property('errorType', expected.name);
    recoveredError.should.have.property('errorMessage', expected.message);
    recoveredError.should.have.property('stack', expected.stack.split('\n'));
    recoveredError.should.have.property('code', expected.code);
    recoveredError.should.have.property('custom', expected.custom);
  });

  describe('Structured logging', () => {
    const EXPECTED_ID = 'structured logging request id';
    const originalDate = Date;
    beforeEach('set the request id', () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });

    beforeEach('turn on structured logging', () => {
      fakeLoggingConfig.turnOnStructuredLogging();
      telemetryTarget.openFile();
      telemetryTarget.updateEnv();
      LogPatch.patchConsole();
    });
    beforeEach('freeze current date', () => {
      function mockDate() {
        return new originalDate('2023-09-25T12:00:00Z');
      }
      global.Date = mockDate;
    });

    afterEach('turn off structured logging & reset log level', () => {
      fakeLoggingConfig.turnOffStructuredLogging();
      fakeLoggingConfig.resetLogLevel();
    });
    afterEach('unfreeze current date', () => {
      global.Date = originalDate;
    });

    it('should format messages as json correctly', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        logFunctions[fIdx][0](
          'hello',
          3.14,
          'structured logging',
          false,
          { test: 'structured logging' },
          ['random', 'logs'],
        );
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);

        receivedMessage.should.have.property('timestamp');
        let receivedTime = new Date(receivedMessage.timestamp);
        let now = new Date();
        assert(now >= receivedTime && now - receivedTime <= 1000);

        receivedMessage.should.have.property(
          'message',
          util.format(
            'hello',
            3.14,
            'structured logging',
            false,
            { test: 'structured logging' },
            ['random', 'logs'],
          ),
        );
        receivedMessage.should.have.property('level', logFunctions[fIdx][1]);
        receivedMessage.should.have.property('requestId', EXPECTED_ID);
      }
    });

    it('should filter messages correctly', () => {
      const loglevelSettings = [
        undefined,
        'TRACE',
        'DEBUG',
        'INFO',
        'WARN',
        'ERROR',
        'FATAL',
      ];
      const filterMatrix = [
        [false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false],
        [true, false, false, false, false, false, false],
        [true, true, false, false, false, false, false],
        [true, true, true, true, false, false, false],
        [true, true, true, true, true, false, false],
        [true, true, true, true, true, true, false],
      ];

      let receivedMessage,
        expectEmpty = true;
      for (let idx = 0; idx < loglevelSettings.length; idx++) {
        fakeLoggingConfig.setLogLevel(loglevelSettings[idx]);
        telemetryTarget.openFile();
        telemetryTarget.updateEnv();
        LogPatch.patchConsole();

        for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
          logFunctions[fIdx][0]('random log message');
          if (filterMatrix[idx][fIdx]) {
            telemetryTarget.readLine(
              logFunctions[fIdx][1],
              'JSON',
              expectEmpty,
            );
          } else {
            receivedMessage = telemetryTarget.readLine(
              logFunctions[fIdx][1],
              'JSON',
            );
            receivedMessage = JSON.parse(receivedMessage);
            receivedMessage.should.have.property(
              'message',
              'random log message',
            );
          }
        }
      }
    });

    it('should add error fields to messages if error is supplied', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        let e1 = new SyntaxError('random syntax error');
        let e2 = new ReferenceError('random reference error');
        logFunctions[fIdx][0](
          'logged an error',
          e1,
          'logged another error',
          e2,
        );
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('errorType', e1.constructor.name);
        receivedMessage.should.have.property('errorMessage', e1.message);
        receivedMessage.should.have.property(
          'stackTrace',
          e1.stack.split('\n'),
        );
      }
    });

    it('should handle malformed errors', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        let e1 = new Error(),
          e2 = new Error(),
          e3 = new Error(),
          e4 = new Error(),
          e5 = new Error(),
          e6 = new Error(),
          e7 = new Error(),
          e8 = new Error(),
          e9 = new Error();
        e1.constructor = null;
        e2.stack = null;
        e3.message = null;
        e4.stack = undefined;
        e5.constructor = undefined;
        e6.message = undefined;
        e7.stack = { customStack: 'of object type' };
        e8.message = 1.23;
        e8.constructor = { name: 'overwritten type' };
        e8.stack = 'overwritten\nstack\ntrace';
        e9.errorType = 1.23;
        e9.errorMessage = 456;
        e9.stackTrace = 'overwritten';

        logFunctions[fIdx][0]('error with null constructor', e1);
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('errorType', 'UnknownError');

        logFunctions[fIdx][0]('error with undefined constructor', e5);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('errorType', 'UnknownError');

        logFunctions[fIdx][0]('error with null stacktrace', e2);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('stackTrace', []);

        logFunctions[fIdx][0]('error with undefined stacktrace', e4);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('stackTrace', []);

        logFunctions[fIdx][0]('error with non-string stacktrace', e7);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('stackTrace', []);

        logFunctions[fIdx][0]('error with null message', e3);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.have.property('errorMessage', null);

        logFunctions[fIdx][0]('error with undefined message', e6);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage = JSON.parse(receivedMessage);
        receivedMessage.should.not.have.property('errorMessage');

        logFunctions[fIdx][0](
          'error with overwritten `message`, `constructor.name`, `stack`',
          e8,
        );
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: util.format(
              'error with overwritten `message`, `constructor.name`, `stack`',
              e8,
            ),
            errorType: 'overwritten type',
            errorMessage: 1.23,
            stackTrace: ['overwritten', 'stack', 'trace'],
          }),
        );

        logFunctions[fIdx][0](
          'error with overwritten `errorType`, `errorMessage`, `stackTrace`',
          e9,
        );
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: util.format(
              'error with overwritten `errorType`, `errorMessage`, `stackTrace`',
              e9,
            ),
            errorType: 'Error',
            errorMessage: '',
            stackTrace: e9.stack.split('\n'),
          }),
        );
      }
    });

    it('should not strinfigy single arg', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        logFunctions[fIdx][0](100.123);
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: 100.123,
          }),
        );

        logFunctions[fIdx][0]([
          { someKey: 'some_val', data: 1000 },
          false,
          [1, 2, 3],
          3.14,
        ]); // arrays
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: [
              { someKey: 'some_val', data: 1000 },
              false,
              [1, 2, 3],
              3.14,
            ],
          }),
        );

        logFunctions[fIdx][0]({ transactionId: 100, data: 3.14, state: false }); // objects
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: { transactionId: 100, data: 3.14, state: false },
          }),
        );
      }
    });

    it('should use custom serializer for single arg containing error instances', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        let err = new TypeError('some message');
        logFunctions[fIdx][0](err);
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              errorType: 'TypeError',
              errorMessage: 'some message',
              stackTrace: err.stack.split('\n'),
            },
          }),
        );

        // malformed null error
        err = new Error('some error');
        err.constructor = null;
        err.message = null;
        err.stack = null;
        logFunctions[fIdx][0](err);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              errorType: 'UnknownError',
              errorMessage: null,
              stackTrace: null,
              constructor: null,
            },
          }),
        );

        // malformed undefined error
        err = new Error('some error');
        err.constructor = undefined;
        err.message = undefined;
        err.stack = undefined;
        logFunctions[fIdx][0](err);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              errorType: 'UnknownError',
            },
          }),
        );

        // nested error
        err = new ReferenceError('some error message');
        logFunctions[fIdx][0]({ transactionId: 100, error: err });
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              transactionId: 100,
              error: {
                errorType: 'ReferenceError',
                errorMessage: 'some error message',
                stackTrace: err.stack.split('\n'),
              },
            },
          }),
        );

        // error with custom fields
        err = new SyntaxError('some error');
        err.custom1 = 'custom error data';
        err.custom2 = 123.456;
        logFunctions[fIdx][0](err);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              errorType: 'SyntaxError',
              errorMessage: 'some error',
              stackTrace: err.stack.split('\n'),
              custom1: 'custom error data',
              custom2: 123.456,
            },
          }),
        );

        // error with overriden `err.message`, `err.constructor.name`, `err.stack`
        err = new SyntaxError('some error');
        err.message = 123.456;
        err.constructor = { name: false };
        err.stack = { customStack: 'should not be formatted' };
        logFunctions[fIdx][0](err);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              errorType: false,
              errorMessage: 123.456,
              stackTrace: { customStack: 'should not be formatted' },
              constructor: { name: false },
            },
          }),
        );

        // error with overriden `errorMessage`, `errorType`, `stackTrace`
        err = new SyntaxError('some error');
        err.errorType = 1.23;
        err.errorMessage = 456;
        err.stackTrace = ['random', 'values', 1, 2, false];
        logFunctions[fIdx][0](err);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: {
              errorType: 1.23,
              errorMessage: 456,
              stackTrace: ['random', 'values', 1, 2, false],
            },
          }),
        );
      }
    });
    it('should default to stringifying if single arg contains un-serializable objects', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        // circular object
        let obj = { data: 123 };
        obj.backlink = obj;

        logFunctions[fIdx][0](obj);
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: '<ref *1> { data: 123, backlink: [Circular *1] }',
          }),
        );

        // circular error
        let err = new Error('circular error');
        err.backlink = err;
        logFunctions[fIdx][0](err);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: util.format(err),
          }),
        );
      }
    });
    it('should handle single arg object with custom toJSON implementation', () => {
      for (let fIdx = 0; fIdx < logFunctions.length; fIdx++) {
        let obj = { data: 123 };
        obj.toJSON = () => 'custom serialized';

        logFunctions[fIdx][0](obj);
        let receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message: 'custom serialized',
          }),
        );

        logFunctions[fIdx][0]('as part of multiple args', obj);
        receivedMessage = telemetryTarget.readLine(
          logFunctions[fIdx][1],
          'JSON',
        );
        receivedMessage.should.be.equal(
          JSON.stringify({
            timestamp: '2023-09-25T12:00:00.000Z',
            level: logFunctions[fIdx][1],
            requestId: 'structured logging request id',
            message:
              'as part of multiple args { data: 123, toJSON: [Function (anonymous)] }',
          }),
        );
      }
    });
    it(' `structuredConsole.logError()` output should not be stringified in JSON mode', () => {
      let err = new SyntaxError('user syntax error');
      err.code = 123;
      LogPatch.structuredConsole.logError('Invoke Error', err);

      let receivedMessage = telemetryTarget.readLine('ERROR', 'JSON');
      receivedMessage.should.be.equal(
        JSON.stringify({
          timestamp: '2023-09-25T12:00:00.000Z',
          level: 'ERROR',
          requestId: 'structured logging request id',
          message: {
            errorType: 'SyntaxError',
            errorMessage: 'user syntax error',
            stackTrace: err.stack.split('\n'),
            code: 123,
          },
        }),
      );
    });
  });
});
