import { UserFunctionLoader } from "../function/index.js";
import { UserHandler } from "../runtime/types.js";
import { HttpResponseStream } from "../stream/index.js";

interface StreamifyResponseOptions {
  highWaterMark?: number;
}

export function setupGlobals(): void {
  // AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA provides an escape hatch since we're modifying the global object which may not be expected to a customer's handler.
  const NoGlobalAwsLambda =
    process.env["AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA"] === "1" ||
    process.env["AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA"] === "true";

  if (!NoGlobalAwsLambda) {
    type HandlerWithMetadata = UserHandler & {
      [UserFunctionLoader.HANDLER_STREAMING]?: string;
      [UserFunctionLoader.HANDLER_HIGHWATERMARK]?: number;
    };

    globalThis.awslambda = {
      ...globalThis.awslambda,
      streamifyResponse: (
        handler: UserHandler,
        options: StreamifyResponseOptions,
      ) => {
        const typedHandler = handler as HandlerWithMetadata;
        typedHandler[UserFunctionLoader.HANDLER_STREAMING] =
          UserFunctionLoader.STREAM_RESPONSE;
        if (typeof options?.highWaterMark === "number") {
          typedHandler[UserFunctionLoader.HANDLER_HIGHWATERMARK] = parseInt(
            String(options.highWaterMark),
          );
        }
        return handler;
      },
      HttpResponseStream,
    };
  }
}
