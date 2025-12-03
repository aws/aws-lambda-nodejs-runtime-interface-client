import { HandlerMetadata } from "../function/types.js";
import {
  BufferedHandler,
  InvokeProcessor,
  RuntimeOptions,
  StreamingHandler,
  UserHandler,
} from "./types.js";
import { InvokeStore, InvokeStoreBase } from "@aws/lambda-invoke-store";
import { LifecycleManager } from "./lifecycle-manager.js";
import { BufferedInvokeProcessor } from "./buffered-invoke-processor.js";
import { StreamingInvokeProcessor } from "./streaming-invoke-processor.js";

export class Runtime {
  public static create({
    rapidClient,
    handler,
    handlerMetadata = {},
    isMultiConcurrent = false,
  }: RuntimeOptions): Runtime {
    return new Runtime(
      handler,
      handlerMetadata,
      isMultiConcurrent,
      LifecycleManager.create(rapidClient),
    );
  }

  private constructor(
    private readonly handler: UserHandler,
    private readonly handlerMetadata: HandlerMetadata,
    private readonly isMultiConcurrent: boolean,
    private readonly lifecycle: LifecycleManager,
  ) {}

  public async start(): Promise<void> {
    const processor = this.createProcessor();

    if (this.isMultiConcurrent) {
      await this.processMultiConcurrent(processor);
    } else {
      await this.processSingleConcurrent(processor);
    }
  }

  private createProcessor(): InvokeProcessor {
    if (this.handlerMetadata.streaming) {
      return new StreamingInvokeProcessor(
        this.handler as StreamingHandler,
        this.lifecycle,
        this.handlerMetadata,
      );
    } else {
      return new BufferedInvokeProcessor(
        this.handler as BufferedHandler,
        this.lifecycle,
      );
    }
  }

  private async processSingleConcurrent(
    processor: InvokeProcessor,
  ): Promise<void> {
    while (true) {
      const { context, event } = await this.lifecycle.next();

      await this.runWithInvokeContext(
        context.awsRequestId,
        context.xRayTraceId,
        () => processor.processInvoke(context, event),
      );
    }
  }

  private async processMultiConcurrent(
    processor: InvokeProcessor,
  ): Promise<void> {
    while (true) {
      const { context, event } = await this.lifecycle.next();

      setImmediate(async () => {
        await this.runWithInvokeContext(
          context.awsRequestId,
          context.xRayTraceId,
          () => processor.processInvoke(context, event),
        );
      });
    }
  }

  private async runWithInvokeContext(
    requestId: string,
    xRayTraceId: string | undefined,
    fn: () => Promise<void>,
  ): Promise<void> {
    const invokeStore = await InvokeStore.getInstanceAsync();
    return invokeStore.run(
      {
        [InvokeStoreBase.PROTECTED_KEYS.REQUEST_ID]: requestId,
        [InvokeStoreBase.PROTECTED_KEYS.X_RAY_TRACE_ID]: xRayTraceId,
      },
      fn,
    );
  }
}
