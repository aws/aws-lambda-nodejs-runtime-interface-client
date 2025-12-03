import { UserHandler } from "../runtime/types.js";
import {
  MalformedHandlerNameError,
  MalformedStreamingHandler,
  parseHandlerString,
} from "../utils/index.js";
import {
  loadModule,
  resolveHandler,
  LoadedHandler,
  HandlerMetadata,
} from "./index.js";

export class UserFunctionLoader {
  public static readonly HANDLER_STREAMING = Symbol.for(
    "aws.lambda.runtime.handler.streaming",
  );
  public static readonly HANDLER_HIGHWATERMARK = Symbol.for(
    "aws.lambda.runtime.handler.streaming.highWaterMark",
  );
  public static readonly STREAM_RESPONSE = "response";

  private static readonly RELATIVE_PATH_SUBSTRING = "..";

  public static async load(
    appRoot: string,
    handlerString: string,
  ): Promise<LoadedHandler> {
    this.validateHandlerString(handlerString);

    const { moduleRoot, moduleName, handlerName } =
      parseHandlerString(handlerString);
    const module = await loadModule({
      appRoot,
      moduleRoot,
      moduleName,
    });
    const handler = resolveHandler(module, handlerName, handlerString);

    return {
      handler,
      metadata: this.getHandlerMetadata(handler),
    };
  }

  private static getHandlerMetadata(handler: UserHandler): HandlerMetadata {
    return {
      streaming: this.isHandlerStreaming(handler),
      highWaterMark: this.getHighWaterMark(handler),
      argsNum: handler.length,
    };
  }

  private static isHandlerStreaming(handler: UserHandler): boolean {
    const streamingValue = (handler as unknown as Record<symbol, unknown>)[
      this.HANDLER_STREAMING
    ];

    if (!streamingValue) {
      return false;
    }

    if (streamingValue === this.STREAM_RESPONSE) {
      return true;
    }
    throw new MalformedStreamingHandler(
      "Only response streaming is supported.",
    );
  }

  private static getHighWaterMark(handler: UserHandler): number | undefined {
    const waterMarkValue = (handler as unknown as Record<symbol, unknown>)[
      this.HANDLER_HIGHWATERMARK
    ];

    if (!waterMarkValue) {
      return undefined;
    }

    const hwm = Number(waterMarkValue);
    return Number.isNaN(hwm) ? undefined : hwm;
  }

  private static validateHandlerString(handlerString: string): void {
    if (handlerString.includes(this.RELATIVE_PATH_SUBSTRING)) {
      throw new MalformedHandlerNameError(
        `'${handlerString}' is not a valid handler name. Use absolute paths when specifying root directories in handler names.`,
      );
    }
  }
}
