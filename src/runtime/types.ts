import { RAPIDClient } from "../client/index.js";
import type { InvokeContext } from "../context/index.js";
import { HandlerMetadata } from "../function/index.js";
import { WritableResponseStream } from "../stream/index.js";

export type BufferedHandler = (
  event: unknown,
  context?: InvokeContext,
) => Promise<unknown>;

export type StreamingHandler = (
  event: unknown,
  responseStream: WritableResponseStream,
  context: InvokeContext,
) => Promise<unknown>;

export type UserHandler = BufferedHandler | StreamingHandler;

export interface ErrorCallbacks {
  uncaughtExceptionCallback: (error: Error) => Promise<void>;
  unhandledRejectionCallback: (error: Error) => Promise<void>;
}

export interface RuntimeOptions {
  rapidClient: RAPIDClient;
  handler: UserHandler;
  handlerMetadata?: HandlerMetadata;
  isMultiConcurrent?: boolean;
}

export interface InvokeProcessor {
  processInvoke(context: InvokeContext, event: unknown): Promise<void>;
}
