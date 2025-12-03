import type { Logger, BaseLoggerOptions } from "./types.js";
import { LogLevel } from "./constants.js";
import { InvokeStoreBase } from "@aws/lambda-invoke-store";

export abstract class BaseLogger implements Logger {
  protected readonly invokeStore: InvokeStoreBase;
  public constructor(
    protected readonly options: BaseLoggerOptions,
    protected readonly invokeStoreParam: InvokeStoreBase,
  ) {
    this.invokeStore = invokeStoreParam;
  }

  public abstract log(
    level: LogLevel,
    message: unknown,
    ...params: unknown[]
  ): void;

  public shouldLog(level: LogLevel): boolean {
    return level.priority >= this.options.minLevel.priority;
  }
}
