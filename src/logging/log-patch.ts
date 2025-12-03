import { InvokeStore } from "@aws/lambda-invoke-store";
import {
  acquireSocketFd,
  consumeTelemetryFd,
  determineLogFormat,
  determineLogLevel,
  intoError,
  isMultiConcurrentMode,
  toFormatted,
} from "../utils/index.js";
import { LOG_FORMAT, LOG_LEVEL } from "./constants.js";
import type { LogLevel } from "./constants.js";
import { SocketLogger } from "./socket-logger.js";
import { StdoutLogger } from "./stdout-logger.js";
import { TelemetryLogger } from "./telemetry-logger.js";
import type { BaseLoggerOptions, Logger, StructuredConsole } from "./types.js";

export class LogPatch {
  private static readonly NopLog = (): void => {};
  private static logger: Logger;
  private static options?: BaseLoggerOptions;

  public static async patchConsole(): Promise<void> {
    const options = this.createLoggerOptions();
    this.logger = await this.createLogger(options);
    this.patchConsoleMethods(this.logger);
    this.options = options;
  }

  public static readonly structuredConsole: StructuredConsole = {
    logError(msg: string, err: unknown): void {
      if (LogPatch.logger) {
        const errorLogger =
          LogPatch.options?.format === LOG_FORMAT.JSON
            ? LogPatch.jsonErrorLogger
            : LogPatch.textErrorLogger;

        errorLogger(msg, err);
      }
    },
  };

  private static createLoggerOptions(): BaseLoggerOptions {
    return {
      format: determineLogFormat(),
      minLevel: determineLogLevel(),
    };
  }

  private static async createLogger(
    options: BaseLoggerOptions,
  ): Promise<Logger> {
    const invokeStore = await InvokeStore.getInstanceAsync();
    if (isMultiConcurrentMode()) {
      const socketFd = await acquireSocketFd();
      return new SocketLogger(socketFd, options, invokeStore);
    }

    const telemetryFd = consumeTelemetryFd();
    if (telemetryFd) {
      return new TelemetryLogger(telemetryFd, options, invokeStore);
    }
    return new StdoutLogger(options, invokeStore);
  }

  private static patchConsoleMethods(logger: Logger): void {
    const createLogFunction = (level: LogLevel) => {
      if (!logger.shouldLog(level)) {
        return this.NopLog;
      }

      return (message: unknown, ...params: unknown[]): void => {
        logger.log(level, message, ...params);
      };
    };

    console.trace = createLogFunction(LOG_LEVEL.TRACE);
    console.debug = createLogFunction(LOG_LEVEL.DEBUG);
    console.info = createLogFunction(LOG_LEVEL.INFO);
    console.warn = createLogFunction(LOG_LEVEL.WARN);
    console.error = createLogFunction(LOG_LEVEL.ERROR);
    console.fatal = createLogFunction(LOG_LEVEL.FATAL);
    console.log = console.info;
  }

  private static readonly jsonErrorLogger = (_: string, err: unknown) => {
    console.error(intoError(err));
  };

  private static readonly textErrorLogger = (msg: string, err: unknown) => {
    console.error(msg, toFormatted(intoError(err)));
  };
}

export const { structuredConsole } = LogPatch;
