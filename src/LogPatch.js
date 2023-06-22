/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const util = require('util');
const fs = require('fs');

const levels = Object.freeze({
  INFO: { name: 'INFO' },
  DEBUG: { name: 'DEBUG' },
  WARN: { name: 'WARN' },
  ERROR: { name: 'ERROR' },
  TRACE: { name: 'TRACE' },
  FATAL: { name: 'FATAL' },
});

/* Use a unique symbol to provide global access without risk of name clashes. */
const REQUEST_ID_SYMBOL = Symbol.for('aws.lambda.runtime.requestId');
let _currentRequestId = {
  get: () => global[REQUEST_ID_SYMBOL],
  set: (id) => (global[REQUEST_ID_SYMBOL] = id),
};

/**
 * Write logs to stdout.
 */
let _logToStdout = (level, message) => {
  let time = new Date().toISOString();
  let requestId = _currentRequestId.get();
  let line = `${time}\t${requestId}\t${level.name}\t${message}`;
  line = line.replace(/\n/g, '\r');
  process.stdout.write(line + '\n');
};

/**
 * Write logs to filedescriptor.
 * Implements the logging contract between runtimes and the platform.
 * Each entry is framed as:
 *    +----------------------+------------------------+---------------------+-----------------------+
 *    | Frame Type - 4 bytes | Length (len) - 4 bytes | Timestamp - 8 bytes | Message - 'len' bytes |
 *    +----------------------+------------------------+---------------------+-----------------------+
 * The frist 4 bytes are the frame type. For logs this is always 0xa55a0003.
 * The second 4 bytes are the length of the message.
 * The next 8 bytes are the UNIX timestamp of the message with microseconds precision.
 * The remaining bytes ar ethe message itself. Byte order is big-endian.
 */
let _logToFd = function (logTarget) {
  let typeAndLength = Buffer.alloc(16);
  typeAndLength.writeUInt32BE(0xa55a0003, 0);

  return (level, message) => {
    let date = new Date();
    let time = date.toISOString();
    let requestId = _currentRequestId.get();
    let enrichedMessage = `${time}\t${requestId}\t${level.name}\t${message}\n`;
    let messageBytes = Buffer.from(enrichedMessage, 'utf8');
    typeAndLength.writeInt32BE(messageBytes.length, 4);
    typeAndLength.writeBigInt64BE(BigInt(date.valueOf()) * 1000n, 8);
    fs.writeSync(logTarget, typeAndLength);
    fs.writeSync(logTarget, messageBytes);
  };
};

/**
 * Replace console functions with a log function.
 * @param {Function(level, String)} log
 */
function _patchConsoleWith(log) {
  console.log = (msg, ...params) => {
    log(levels.INFO, util.format(msg, ...params));
  };
  console.debug = (msg, ...params) => {
    log(levels.DEBUG, util.format(msg, ...params));
  };
  console.info = (msg, ...params) => {
    log(levels.INFO, util.format(msg, ...params));
  };
  console.warn = (msg, ...params) => {
    log(levels.WARN, util.format(msg, ...params));
  };
  console.error = (msg, ...params) => {
    log(levels.ERROR, util.format(msg, ...params));
  };
  console.trace = (msg, ...params) => {
    log(levels.TRACE, util.format(msg, ...params));
  };
  console.fatal = (msg, ...params) => {
    log(levels.FATAL, util.format(msg, ...params));
  };
}

let _patchConsole = () => {
  if (
    process.env['_LAMBDA_TELEMETRY_LOG_FD'] != null &&
    process.env['_LAMBDA_TELEMETRY_LOG_FD'] != undefined
  ) {
    let logFd = parseInt(process.env['_LAMBDA_TELEMETRY_LOG_FD']);
    _patchConsoleWith(_logToFd(logFd));
    delete process.env['_LAMBDA_TELEMETRY_LOG_FD'];
  } else {
    _patchConsoleWith(_logToStdout);
  }
};

module.exports = {
  setCurrentRequestId: _currentRequestId.set,
  patchConsole: _patchConsole,
};
