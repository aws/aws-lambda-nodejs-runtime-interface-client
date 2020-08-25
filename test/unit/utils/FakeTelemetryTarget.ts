/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";

const _LOG_IDENTIFIER = Buffer.from("a55a0001", "hex");

/**
 * A fake implementation of the multilne logging protocol.
 * Read and write log frames to a temp file and provide an asserting helper for
 * reading individual log statements from the file.
 */
export default class FakeTelemetryTarget {
  readTarget: number;
  writeTarget: number;

  constructor() {
    this.readTarget = 0;
    this.writeTarget = 0;
  }

  openFile(): void {
    const tempTelemetryDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "LambdyBYOLNodeJs12xTelemetry-")
    );
    this.writeTarget = fs.openSync(path.join(tempTelemetryDir, "log"), "as+");
    this.readTarget = fs.openSync(path.join(tempTelemetryDir, "log"), "rs+");
    console.log(
      "Generate new telemetry file",
      tempTelemetryDir,
      "with file descriptor",
      this.readTarget
    );
  }

  closeFile(): void {
    console.log(`Close telemetry filedescriptor ${this.readTarget}`);
    fs.closeSync(this.readTarget);
    fs.closeSync(this.writeTarget);
    this.readTarget = 0;
    this.writeTarget = 0;
  }

  updateEnv(): void {
    process.env["_LAMBDA_TELEMETRY_LOG_FD"] = this.writeTarget.toString();
  }

  /**
   * Read a single line from the telemetry file.
   * Explodes when:
   * - no line is present
   * - the prefix is malformed
   * - there aren't enough bytes
   */
  readLine(): string {
    const readLength = () => {
      const logPrefix = Buffer.alloc(8);
      const actualReadBytes = fs.readSync(
        this.readTarget,
        logPrefix,
        0,
        logPrefix.length,
        null
      );
      assert.strictEqual(
        actualReadBytes,
        logPrefix.length,
        `Expected actualReadBytes[${actualReadBytes}] = ${logPrefix.length}`
      );
      assert.strictEqual(
        logPrefix.lastIndexOf(_LOG_IDENTIFIER),
        0,
        `log prefix ${logPrefix.toString(
          "hex"
        )} should start with ${_LOG_IDENTIFIER.toString("hex")}`
      );
      return logPrefix.readInt32BE(4);
    };

    const lineLength = readLength();
    const lineBytes = Buffer.alloc(lineLength);
    const actualLineSize = fs.readSync(
      this.readTarget,
      lineBytes,
      0,
      lineBytes.length,
      null
    );
    assert.strictEqual(
      actualLineSize,
      lineBytes.length,
      "The log line must match the length specified in the frame header"
    );
    return lineBytes.toString("utf8");
  }
}
