import { BaseLogger } from "./base-logger.js";
import type { LogLevel } from "./constants.js";
import { FORMAT } from "./constants.js";
import { formatJsonMessage } from "./formatter.js";
import { cjsRequire } from "../utils/cjs-require.js";
import { BaseLoggerOptions } from "./types.js";
import { InvokeStoreBase } from "@aws/lambda-invoke-store";

const fs = cjsRequire("node:fs");

export class SocketLogger extends BaseLogger {
  public constructor(
    private readonly fd: number,
    options: BaseLoggerOptions,
    protected readonly invokeStore: InvokeStoreBase,
  ) {
    super(options, invokeStore);
  }

  public log(level: LogLevel, message: unknown, ...params: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const requestId = this.invokeStore.getRequestId();
    const tenantId = this.invokeStore.getTenantId() || "";

    const line =
      formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        message,
        ...params,
      ).replace(/\n/g, FORMAT.CARRIAGE_RETURN) + FORMAT.LINE_DELIMITER;
    fs.writeSync(this.fd, line);
  }
}
