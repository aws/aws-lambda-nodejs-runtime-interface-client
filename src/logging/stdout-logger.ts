import { BaseLogger } from "./base-logger.js";
import type { LogLevel } from "./constants.js";
import { FORMAT, LOG_FORMAT } from "./constants.js";
import { formatJsonMessage, formatTextMessage } from "./formatter.js";

export class StdoutLogger extends BaseLogger {
  public log(level: LogLevel, message: unknown, ...params: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const requestId = this.invokeStore.getRequestId();
    const tenantId = this.invokeStore.getTenantId() || "";

    if (this.options.format === LOG_FORMAT.JSON) {
      this.logJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        message,
        ...params,
      );
    } else {
      // tenant-id is not supported in non-structured logs
      this.logTextMessge(timestamp, requestId, level, message, ...params);
    }
  }

  private logTextMessge(
    timestamp: string,
    requestId: string,
    level: LogLevel,
    message: unknown,
    ...params: unknown[]
  ) {
    const line = formatTextMessage(
      timestamp,
      requestId,
      level,
      message,
      ...params,
    ).replace(/\n/g, FORMAT.CARRIAGE_RETURN);
    process.stdout.write(line + FORMAT.LINE_DELIMITER);
  }

  private logJsonMessage(
    timestamp: string,
    requestId: string,
    tenantId: string,
    level: LogLevel,
    message: unknown,
    ...params: unknown[]
  ) {
    const line = formatJsonMessage(
      timestamp,
      requestId,
      tenantId,
      level,
      message,
      ...params,
    ).replace(/\n/g, FORMAT.CARRIAGE_RETURN);
    process.stdout.write(line + FORMAT.LINE_DELIMITER);
  }
}
