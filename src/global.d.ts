import { HttpResponseStream } from "./stream/index.ts";

declare global {
  // eslint-disable-next-line no-var
  var awslambda: {
    /**
     * Marks a handler as streaming and (optionally) captures a highWaterMark.
     */
    streamifyResponse(
      handler: unknown,
      options?: { highWaterMark?: unknown },
    ): unknown;

    /** The same HttpResponseStream helper you already wrote */
    HttpResponseStream: typeof HttpResponseStream;
  };

  interface Console {
    fatal: (message?: unknown, ...params: unknown[]) => void;
  }
}

export {};
