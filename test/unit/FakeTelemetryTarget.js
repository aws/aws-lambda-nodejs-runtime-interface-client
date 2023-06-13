/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const _LOG_IDENTIFIER = Buffer.from('a55a0003', 'hex');

/**
 * A fake implementation of the multilne logging protocol.
 * Read and write log frames to a temp file and provide an asserting helper for
 * reading individual log statements from the file.
 */
module.exports = class FakeTelemetryTarget {
  constructor() {
    this.readTarget = 0;
    this.writeTarget = 0;
  }

  openFile() {
    let tempTelemetryDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'AWSLambdaNodeJsTelemetry-'),
    );
    this.writeTarget = fs.openSync(path.join(tempTelemetryDir, 'log'), 'as+');
    this.readTarget = fs.openSync(path.join(tempTelemetryDir, 'log'), 'rs+');
    console.log(
      'Generate new telemetry file',
      tempTelemetryDir,
      'with file descriptor',
      this.readTarget,
    );
  }

  closeFile() {
    console.log(`Close telemetry filedescriptor ${this.readTarget}`);
    fs.closeSync(this.readTarget);
    fs.closeSync(this.writeTarget);
    this.readTarget = 0;
    this.writeTarget = 0;
  }

  updateEnv() {
    process.env['_LAMBDA_TELEMETRY_LOG_FD'] = this.writeTarget;
  }

  /**
   * Read a single line from the telemetry file.
   * Explodes when:
   * - no line is present
   * - the prefix is malformed
   * - there aren't enough bytes
   */
  readLine() {
    let readLength = () => {
      let logPrefix = Buffer.alloc(16);
      let actualReadBytes = fs.readSync(
        this.readTarget,
        logPrefix,
        0,
        logPrefix.length,
      );
      assert.strictEqual(
        actualReadBytes,
        logPrefix.length,
        `Expected actualReadBytes[${actualReadBytes}] = ${logPrefix.length}`,
      );
      assert.strictEqual(
        logPrefix.lastIndexOf(_LOG_IDENTIFIER),
        0,
        `log prefix ${logPrefix.toString(
          'hex',
        )} should start with ${_LOG_IDENTIFIER.toString('hex')}`,
      );
      let len = logPrefix.readUInt32BE(4);
      // discard the timestamp
      logPrefix.readBigUInt64BE(8);
      return len;
    };

    let lineLength = readLength();
    let lineBytes = Buffer.alloc(lineLength);
    let actualLineSize = fs.readSync(
      this.readTarget,
      lineBytes,
      0,
      lineBytes.length,
    );
    assert.strictEqual(
      actualLineSize,
      lineBytes.length,
      'The log line must match the length specified in the frame header',
    );
    return lineBytes.toString('utf8');
  }
};
