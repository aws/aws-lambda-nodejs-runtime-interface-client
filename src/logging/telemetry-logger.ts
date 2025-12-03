import { BaseLogger } from "./base-logger.js";
import type { BaseLoggerOptions } from "./types.js";
import type { LogLevel, TelemetryFrameType } from "./constants.js";
import { FORMAT, LOG_FORMAT, TELEMETRY } from "./constants.js";
import { formatJsonMessage, formatTextMessage } from "./formatter.js";
import { cjsRequire } from "../utils/cjs-require.js";
import { InvokeStoreBase } from "@aws/lambda-invoke-store";

const fs = cjsRequire("node:fs");

export class TelemetryLogger extends BaseLogger {
  private readonly buffer: Buffer;

  public constructor(
    private readonly fd: number,
    options: BaseLoggerOptions,
    protected readonly invokeStore: InvokeStoreBase,
  ) {
    super(options, invokeStore);
    this.buffer = Buffer.alloc(TELEMETRY.FRAME_HEADER_SIZE);
  }

  public log(level: LogLevel, message: unknown, ...params: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const now = new Date();
    const requestId = this.invokeStore.getRequestId();
    const tenantId = this.invokeStore.getTenantId() || "";

    if (this.options.format === LOG_FORMAT.JSON) {
      this.logJsonMessge(now, requestId, tenantId, level, message, ...params);
    } else {
      this.logTextMessge(now, requestId, level, message, ...params);
    }
  }

  private logTextMessge(
    now: Date,
    requestId: string,
    level: LogLevel,
    message: unknown,
    ...params: unknown[]
  ) {
    const line =
      formatTextMessage(
        now.toISOString(),
        requestId,
        level,
        message,
        ...params,
      ) + FORMAT.LINE_DELIMITER;
    this.writeFrame(level, now, line, TELEMETRY.FRAME_TYPE_TEXT);
  }

  private logJsonMessge(
    now: Date,
    requestId: string,
    tenantId: string,
    level: LogLevel,
    message: unknown,
    ...params: unknown[]
  ) {
    const line = formatJsonMessage(
      now.toISOString(),
      requestId,
      tenantId,
      level,
      message,
      ...params,
    );
    this.writeFrame(level, now, line, TELEMETRY.FRAME_TYPE_JSON);
  }

  /**
   * Write logs to filedescriptor.
   * Implements the logging contract between runtimes and the platform.
   * Each entry is framed as:
   *    +----------------------+------------------------+---------------------+-----------------------+
   *    | Frame Type - 4 bytes | Length (len) - 4 bytes | Timestamp - 8 bytes | Message - 'len' bytes |
   *    +----------------------+------------------------+---------------------+-----------------------+
   * The first 4 bytes are the frame type. For text logs this is always 0xa55a0003, while for
   * json logs this is calculated as bitiwise OR of 0xa55a0002 and tlv mask of corresponding message log level.
   * The second 4 bytes are the length of the message.
   * The next 8 bytes are the UNIX timestamp of the message with microseconds precision.
   * The remaining bytes are the message itself. Byte order is big-endian.
   */
  private writeFrame(
    level: LogLevel,
    now: Date,
    message: string,
    frameType: TelemetryFrameType,
  ): void {
    // Frame Type
    this.buffer.writeUInt32BE(
      (frameType | level.tlvMask) >>> 0,
      TELEMETRY.TYPE_OFFSET,
    );

    // Message Length
    const messageBuffer = Buffer.from(message, "utf8");
    this.buffer.writeInt32BE(messageBuffer.length, TELEMETRY.LENGTH_OFFSET);

    // Timestamp
    this.buffer.writeBigInt64BE(
      BigInt(now.valueOf()) * 1000n,
      TELEMETRY.TIMESTAMP_OFFSET,
    );

    // Write frame header and message
    fs.writeSync(this.fd, this.buffer);
    fs.writeSync(this.fd, messageBuffer);
  }
}
