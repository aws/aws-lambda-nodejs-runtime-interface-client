import { RAPIDClient } from "../client/index.js";
import { ContextBuilder } from "../context/index.js";
import {
  EventAndContext,
  ResponseStreamKit,
  StreamOptions,
} from "../context/types.js";
import { logger, structuredConsole } from "../logging/index.js";
import { tryCallFail, WritableResponseStream } from "../stream/index.js";

const log = logger("STREAM");

export class LifecycleManager {
  public static create(rapidClient: RAPIDClient): LifecycleManager {
    return new LifecycleManager(rapidClient);
  }

  private constructor(private readonly client: RAPIDClient) {}

  public async fail(requestId: string, error: unknown): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
    structuredConsole.logError("Invoke Error", error);
    this.client.postInvocationError(error, requestId);
  }

  public async failResponseStream(
    responseStream: WritableResponseStream,
    error: unknown,
  ) {
    await new Promise((resolve) => setImmediate(resolve));
    log.verbose("Runtime::handleOnceStreaming::finally stream destroyed");
    structuredConsole.logError("Invoke Error", error);
    tryCallFail(responseStream, error);
  }

  public async succeed(requestId: string, result: unknown): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
    this.client.postInvocationResponse(result, requestId);
  }

  public async next(): Promise<EventAndContext> {
    const invocationRequest = await this.client.nextInvocation();
    const context = ContextBuilder.build(invocationRequest.headers);
    const event = JSON.parse(invocationRequest.bodyJson);

    return {
      context,
      event,
    };
  }

  public setupResponseStream(
    requestId: string,
    options?: StreamOptions,
  ): ResponseStreamKit {
    const { request, responseDone } =
      this.client.getStreamForInvocationResponse(requestId, options);
    log.vverbose("StreamingContextBuilder::createStream", "stream created");

    return {
      rapidResponse: responseDone,
      responseStream: request,
    };
  }
}
