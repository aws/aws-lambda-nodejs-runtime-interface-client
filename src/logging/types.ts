import type { LogFormat, LogLevel } from "./constants.js";

export interface LoggerFunction {
  (...args: unknown[]): void;
}

export interface VerboseLogger {
  verbose: LoggerFunction;
  vverbose: LoggerFunction;
  vvverbose: LoggerFunction;
}

export interface BaseLoggerOptions {
  format: LogFormat;
  minLevel: LogLevel;
}

export interface Logger {
  log(level: LogLevel, message: unknown, ...params: unknown[]): void;
  shouldLog(level: LogLevel): boolean;
}

export interface StructuredConsole {
  logError(msg: string, err: unknown): void;
}
