/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

/**
 * Testing logging in unit tests requires manipulating the global console and
 * stdout objects.
 * This module provides methods for safely capturing and restoring these
 * objects under test.
 */

const levels = Object.freeze({
  TRACE: { name: 'TRACE' },
  DEBUG: { name: 'DEBUG' },
  INFO: { name: 'INFO' },
  WARN: { name: 'WARN' },
  ERROR: { name: 'ERROR' },
  FATAL: { name: 'FATAL' },
});

const formats = Object.freeze({
  TEXT: { name: 'TEXT' },
  JSON: { name: 'JSON' },
});

module.exports.consoleSnapshot = () => {
  let log = console.log;
  let debug = console.debug;
  let info = console.info;
  let warn = console.warn;
  let error = console.error;
  let trace = console.trace;
  let fatal = console.fatal;

  return function restoreConsole() {
    console.log = log;
    console.debug = debug;
    console.info = info;
    console.warn = warn;
    console.error = error;
    console.trace = trace;
    console.fatal = fatal;
  };
};

/**
 * Capture all of the writes to a given stream.
 */
module.exports.captureStream = function captureStream(stream) {
  let originalWrite = stream.write;
  let buf = '';
  return {
    hook: () => {
      buf = ''; // reset the buffer
      stream.write = function (chunk, _encoding, _callback) {
        buf += chunk.toString();
        originalWrite.apply(stream, arguments);
      };
    },
    unhook: () => (stream.write = originalWrite),
    captured: () => buf,
    resetBuffer: () => (buf = ''),
  };
};

module.exports.loggingConfig = class loggingConfig {
  turnOnStructuredLogging() {
    process.env['AWS_LAMBDA_LOG_FORMAT'] = formats.JSON.name;
  }

  turnOffStructuredLogging() {
    delete process.env['AWS_LAMBDA_LOG_FORMAT'];
  }

  setLogLevel(level) {
    if (levels[level] === undefined) {
      return;
    }
    process.env['AWS_LAMBDA_LOG_LEVEL'] = levels[level].name;
  }

  resetLogLevel() {
    delete process.env['AWS_LAMBDA_LOG_LEVEL'];
  }
};
