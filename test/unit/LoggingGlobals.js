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
  };
};
