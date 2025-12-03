import { InvokeContext } from "../context/types.js";
import { HandlerMetadata } from "../function/types.js";
import { WritableResponseStream } from "../stream/response-stream.js";
import { LifecycleManager } from "./lifecycle-manager.js";
import { InvokeProcessor, StreamingHandler } from "./types.js";
import { logger } from "../logging/index.js";

const log = logger("RUNTIME");

export class StreamingInvokeProcessor implements InvokeProcessor {
  public constructor(
    private readonly handler: StreamingHandler,
    private readonly lifecycle: LifecycleManager,
    private readonly handlerMetadata: HandlerMetadata,
  ) {}

  public async processInvoke(
    context: InvokeContext,
    event: unknown,
  ): Promise<void> {
    const { rapidResponse, responseStream } =
      this.lifecycle.setupResponseStream(context.awsRequestId, {
        highWaterMark: this.handlerMetadata.highWaterMark,
      });

    try {
      log.verbose(
        "StreamingInvokeProcessor::processInvoke",
        "invoking handler",
      );
      const handlerResult = this.handler(event, responseStream, context);
      await this.waitForStreamClosure(
        handlerResult,
        rapidResponse,
        responseStream,
      );
    } catch (err) {
      await this.lifecycle.failResponseStream(responseStream, err);
    }
  }

  private async waitForStreamClosure(
    handlerResult: Promise<unknown>,
    rapidResponse: Promise<Buffer>,
    responseStream: WritableResponseStream,
  ) {
    log.verbose(
      "StreamingInvokeProcessor::waitForStreamClosure",
      "handler returned",
    );

    if (!this.isPromise(handlerResult)) {
      log.verbose(
        "StreamingInvokeProcessor::waitForStreamClosure",
        "Runtime got non-promise response",
      );
      throw new Error("Streaming does not support non-async handlers.");
    }

    const result = await handlerResult;

    if (typeof result !== "undefined") {
      console.warn("Streaming handlers ignore return values.");
    }
    log.verbose(
      "StreamingInvokeProcessor::waitForStreamClosure",
      "result is awaited.",
    );

    const rapidRes = await rapidResponse;
    log.vverbose(
      "StreamingInvokeProcessor::waitForStreamClosure",
      "RAPID response",
      rapidRes,
    );

    if (!responseStream.writableFinished) {
      throw new Error("Response stream is not finished.");
    }
  }

  private isPromise<T = unknown>(value: unknown): value is Promise<T> {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Promise<T>).then === "function"
    );
  }
}
