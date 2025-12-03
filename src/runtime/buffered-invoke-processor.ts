import { InvokeContext } from "../context/types.js";
import { LifecycleManager } from "./lifecycle-manager.js";
import { BufferedHandler, InvokeProcessor } from "./types.js";

export class BufferedInvokeProcessor implements InvokeProcessor {
  public constructor(
    private readonly handler: BufferedHandler,
    private readonly lifecycle: LifecycleManager,
  ) {}

  public async processInvoke(
    context: InvokeContext,
    event: unknown,
  ): Promise<void> {
    try {
      const result = await this.handler(event, context);
      await this.lifecycle.succeed(context.awsRequestId, result);
    } catch (err) {
      await this.lifecycle.fail(context.awsRequestId, err);
    }
  }
}
