/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const util = require('util');
const fs = require('fs');
const Errors = require('./Errors');

const structuredConsole = {};

const jsonErrorReplacer = (_, value) => {
  if (value instanceof Error) {
    let serializedErr = Object.assign(
      {
        errorType: value?.constructor?.name ?? 'UnknownError',
        errorMessage: value.message,
        stackTrace:
          typeof value.stack === 'string'
            ? value.stack.split('\n')
            : value.stack,
      },
      value,
    );
    return serializedErr;
  }
  return value;
};

function formatJsonMessage(
  requestId,
  timestamp,
  level,
  tenantId,
  ...messageParams
) {
  let result = {
    timestamp: timestamp,
    level: level.name,
    requestId: requestId,
  };

  if (tenantId != undefined && tenantId != null) {
    result.tenantId = tenantId;
  }

  if (messageParams.length === 1) {
    result.message = messageParams[0];
    try {
      return JSON.stringify(result, jsonErrorReplacer);
    } catch (_) {
      result.message = util.format(result.message);
      return JSON.stringify(result);
    }
  }

  result.message = util.format(...messageParams);
  for (const param of messageParams) {
    if (param instanceof Error) {
      result.errorType = param?.constructor?.name ?? 'UnknownError';
      result.errorMessage = param.message;
      result.stackTrace =
        typeof param.stack === 'string' ? param.stack.split('\n') : [];
      break;
    }
  }
  return JSON.stringify(result);
}

/* Use a unique symbol to provide global access without risk of name clashes. */
const REQUEST_ID_SYMBOL = Symbol.for('aws.lambda.runtime.requestId');
let _currentRequestId = {
  get: () => global[REQUEST_ID_SYMBOL],
  set: (id) => (global[REQUEST_ID_SYMBOL] = id),
};

/* Use a unique symbol to provide global access without risk of name clashes. */
const TENANT_ID_SYMBOL = Symbol.for('aws.lambda.runtime.tenantId');
let _currentTenantId = {
  get: () => global[TENANT_ID_SYMBOL],
  set: (id) => (global[TENANT_ID_SYMBOL] = id),
};

/**
 * Write logs to stdout.
 */
let logTextToStdout = (level, message, ...params) => {
  let time = new Date().toISOString();
  let requestId = _currentRequestId.get();
  let line = `${time}\t${requestId}\t${level.name}\t${util.format(
    message,
    ...params,
  )}`;
  line = line.replace(/\n/g, '\r');
  process.stdout.write(line + '\n');
};

let logJsonToStdout = (level, message, ...params) => {
  let time = new Date().toISOString();
  let requestId = _currentRequestId.get();
  let tenantId = _currentTenantId.get();
  let line = formatJsonMessage(
    requestId,
    time,
    level,
    tenantId,
    message,
    ...params,
  );
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
let logTextToFd = function (logTarget) {
  let typeAndLength = Buffer.alloc(16);
  return (level, message, ...params) => {
    let date = new Date();
    let time = date.toISOString();
    let requestId = _currentRequestId.get();
    let enrichedMessage = `${time}\t${requestId}\t${level.name}\t${util.format(
      message,
      ...params,
    )}\n`;

    typeAndLength.writeUInt32BE((0xa55a0003 | level.tlvMask) >>> 0, 0);
    let messageBytes = Buffer.from(enrichedMessage, 'utf8');
    typeAndLength.writeInt32BE(messageBytes.length, 4);
    typeAndLength.writeBigInt64BE(BigInt(date.valueOf()) * 1000n, 8);
    fs.writeSync(logTarget, typeAndLength);
    fs.writeSync(logTarget, messageBytes);
  };
};

let logJsonToFd = function (logTarget) {
  let typeAndLength = Buffer.alloc(16);
  return (level, message, ...params) => {
    let date = new Date();
    let time = date.toISOString();
    let requestId = _currentRequestId.get();
    let tenantId = _currentTenantId.get();
    let enrichedMessage = formatJsonMessage(
      requestId,
      time,
      level,
      tenantId,
      message,
      ...params,
    );

    typeAndLength.writeUInt32BE((0xa55a0002 | level.tlvMask) >>> 0, 0);
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
 * Apply log filters, based on `AWS_LAMBDA_LOG_LEVEL` env var
 */
function _patchConsoleWith(log) {
  const NopLog = (_message, ..._params) => {};
  const levels = Object.freeze({
    TRACE: { name: 'TRACE', priority: 1, tlvMask: 0b00100 },
    DEBUG: { name: 'DEBUG', priority: 2, tlvMask: 0b01000 },
    INFO: { name: 'INFO', priority: 3, tlvMask: 0b01100 },
    WARN: { name: 'WARN', priority: 4, tlvMask: 0b10000 },
    ERROR: { name: 'ERROR', priority: 5, tlvMask: 0b10100 },
    FATAL: { name: 'FATAL', priority: 6, tlvMask: 0b11000 },
  });
  let awsLambdaLogLevel =
    levels[process.env['AWS_LAMBDA_LOG_LEVEL']?.toUpperCase()] ?? levels.TRACE;

  if (levels.TRACE.priority >= awsLambdaLogLevel.priority) {
    console.trace = (msg, ...params) => {
      log(levels.TRACE, msg, ...params);
    };
  } else {
    console.trace = NopLog;
  }
  if (levels.DEBUG.priority >= awsLambdaLogLevel.priority) {
    console.debug = (msg, ...params) => {
      log(levels.DEBUG, msg, ...params);
    };
  } else {
    console.debug = NopLog;
  }
  if (levels.INFO.priority >= awsLambdaLogLevel.priority) {
    console.info = (msg, ...params) => {
      log(levels.INFO, msg, ...params);
    };
  } else {
    console.info = NopLog;
  }
  console.log = console.info;
  if (levels.WARN.priority >= awsLambdaLogLevel.priority) {
    console.warn = (msg, ...params) => {
      log(levels.WARN, msg, ...params);
    };
  } else {
    console.warn = NopLog;
  }
  if (levels.ERROR.priority >= awsLambdaLogLevel.priority) {
    console.error = (msg, ...params) => {
      log(levels.ERROR, msg, ...params);
    };
  } else {
    console.error = NopLog;
  }
  console.fatal = (msg, ...params) => {
    log(levels.FATAL, msg, ...params);
  };
}

let _patchConsole = () => {
  const JsonName = 'JSON',
    TextName = 'TEXT';
  let awsLambdaLogFormat =
    process.env['AWS_LAMBDA_LOG_FORMAT']?.toUpperCase() === JsonName
      ? JsonName
      : TextName;
  let jsonErrorLogger = (_, err) => {
      console.error(Errors.intoError(err));
    },
    textErrorLogger = (msg, err) => {
      console.error(msg, Errors.toFormatted(Errors.intoError(err)));
    };

  /** 
  Resolve log format here, instead of inside log function. 
  This avoids conditional statements in the log function hot path.
  **/
  let logger;
  if (
    process.env['_LAMBDA_TELEMETRY_LOG_FD'] != null &&
    process.env['_LAMBDA_TELEMETRY_LOG_FD'] != undefined
  ) {
    let logFd = parseInt(process.env['_LAMBDA_TELEMETRY_LOG_FD']);
    delete process.env['_LAMBDA_TELEMETRY_LOG_FD'];
    logger =
      awsLambdaLogFormat === JsonName ? logJsonToFd(logFd) : logTextToFd(logFd);
  } else {
    logger =
      awsLambdaLogFormat === JsonName ? logJsonToStdout : logTextToStdout;
  }
  _patchConsoleWith(logger);
  structuredConsole.logError =
    awsLambdaLogFormat === JsonName ? jsonErrorLogger : textErrorLogger;
};

module.exports = {
  setCurrentRequestId: _currentRequestId.set,
  setCurrentTenantId: _currentTenantId.set,
  patchConsole: _patchConsole,
  structuredConsole: structuredConsole,
};
