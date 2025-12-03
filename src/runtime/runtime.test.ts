import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { RAPIDClient } from "../client/index.js";
import type { InvocationRequest } from "../client/types.js";
import { BufferedHandler, Runtime, StreamingHandler } from "./index.js";
import { addFailWeakProp, WritableResponseStream } from "../stream/index.js";
import { Writable } from "node:stream";
import { InvokeStore } from "@aws/lambda-invoke-store";

describe("Runtime", () => {
  beforeEach(() => {
    // Set required environment variables for Context
    process.env.AWS_LAMBDA_FUNCTION_NAME = "test-function";
    process.env.AWS_LAMBDA_FUNCTION_VERSION = "1";
    process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = "128";
    process.env.AWS_LAMBDA_LOG_GROUP_NAME = "test-group";
    process.env.AWS_LAMBDA_LOG_STREAM_NAME = "test-stream";

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.AWS_LAMBDA_FUNCTION_VERSION;
    delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
    delete process.env.AWS_LAMBDA_LOG_GROUP_NAME;
    delete process.env.AWS_LAMBDA_LOG_STREAM_NAME;
  });

  describe("[single-concurrent]", () => {
    let invokeStore: Awaited<ReturnType<typeof InvokeStore.getInstanceAsync>>;

    beforeEach(async () => {
      // Enable testing mode and create InvokeStoreSingle (no AWS_LAMBDA_MAX_CONCURRENCY)
      InvokeStore._testing?.reset?.();
      invokeStore = await InvokeStore.getInstanceAsync();
    });

    afterEach(() => {
      InvokeStore._testing?.reset();
    });
    describe("async handler", () => {
      it("should process invocations sequentially", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient();
        const processOrder: string[] = [];

        const BufferedHandler: BufferedHandler = async (_event, context) => {
          processOrder.push(`${context?.awsRequestId}-start`);
          await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work
          processOrder.push(`${context?.awsRequestId}-done`);
          return "done";
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: BufferedHandler,
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 125);

        // THEN
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
        expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledTimes(2);
        expect(processOrder).toEqual([
          "test-id-1-start",
          "test-id-1-done",
          "test-id-2-start",
          "test-id-2-done",
          "test-id-3-start",
        ]);
      });

      it("should handle errors without breaking the sequence", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient();
        const processOrder: string[] = [];

        const BufferedHandler: BufferedHandler = async (_event, context) => {
          const invocationNumber = processOrder.length / 2 + 1;
          processOrder.push(`${context?.awsRequestId}-start`);
          await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work

          if (invocationNumber === 1) {
            processOrder.push(`${context?.awsRequestId}-error`);
            throw new Error("First invocation error");
          }

          processOrder.push(`${context?.awsRequestId}-done`);
          return "done";
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: BufferedHandler,
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 125);

        // THEN
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
        expect(mockRapidClient.postInvocationError).toHaveBeenCalledTimes(1);
        expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledTimes(1);
        expect(processOrder).toEqual([
          "test-id-1-start",
          "test-id-1-error",
          "test-id-2-start",
          "test-id-2-done",
          "test-id-3-start",
        ]);
      });
    });

    describe("streaming handler", () => {
      it("should handle successful streaming response", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient();
        const processOrder: string[] = [];
        const mockResponseStream = {
          write: vi.fn().mockReturnValue(true),
          end: vi.fn(),
          writableFinished: true,
          setContentType: vi.fn(),
        };

        let resolveDone: (value: void | PromiseLike<void>) => void;
        const responsePromise = new Promise<void>((res) => (resolveDone = res));

        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockReturnValue({
            request: mockResponseStream,
            responseDone: responsePromise,
          });

        const streamingHandler: StreamingHandler = async (
          _event,
          responseStream,
          context,
        ) => {
          processOrder.push(`${context.awsRequestId}-start`);
          await new Promise((resolve) => setTimeout(resolve, 25)); // Simulate work
          responseStream.write("streaming data");
          setTimeout(() => {
            // Simulate work
            // simulate trigger exit event
            processOrder.push(`${context.awsRequestId}-done`);
            responseStream.end();
            // simulate RAPID closing stream in response to our .end().
            resolveDone();
          }, 25);
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: streamingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 65);

        // THEN
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(2);
        expect(mockResponseStream.write).toHaveBeenCalledWith("streaming data");
        expect(mockResponseStream.end).toHaveBeenCalled();
        expect(processOrder).toEqual([
          "test-id-1-start",
          "test-id-1-done",
          "test-id-2-start",
        ]);
      });

      it("should handle non-async streaming handlers", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3);
        const processOrder: string[] = [];

        const responseStreamWithFail = new Writable({
          write: vi.fn((_chunk, _encoding, callback) => callback()),
        }) as unknown as WritableResponseStream;

        addFailWeakProp(responseStreamWithFail, async (err) => {
          processOrder.push(`fail-called-with-${(err as Error).message}`);
        });

        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockReturnValue({
            request: responseStreamWithFail,
            responseDone: Promise.resolve(),
          });

        const nonBufferedHandler = () => {
          processOrder.push(`handler-called`);
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: nonBufferedHandler as unknown as StreamingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 20);

        // THEN
        expect(processOrder).toEqual([
          "handler-called",
          "fail-called-with-Streaming does not support non-async handlers.",
          "handler-called",
          "fail-called-with-Streaming does not support non-async handlers.",
        ]);
        expect(mockRapidClient.nextInvocation).toBeCalledTimes(3);
      });

      it("should handle unfinished streams", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3);
        const processOrder: string[] = [];

        const responseStreamWithFail = new Writable({
          write: vi.fn((_chunk, _encoding, callback) => callback()),
        }) as unknown as WritableResponseStream;

        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockReturnValue({
            request: responseStreamWithFail,
            responseDone: Promise.resolve(),
          });

        addFailWeakProp(responseStreamWithFail, async (err) => {
          processOrder.push(`fail-called-with-${(err as Error).message}`);
        });

        const nonClosingHandler = async (
          _event: unknown,
          responseStream: WritableResponseStream,
        ) => {
          processOrder.push("handler-called");
          responseStream.write("foo");
          return Promise.resolve();
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: nonClosingHandler as unknown as StreamingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 20);

        // THEN
        expect(processOrder).toEqual([
          "handler-called",
          "fail-called-with-Response stream is not finished.",
          "handler-called",
          "fail-called-with-Response stream is not finished.",
        ]);
        expect(mockRapidClient.nextInvocation).toBeCalled();
      });

      it("should handle streaming handler errors", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3);
        const processOrder: string[] = [];

        const responseStreamWithFail = new Writable({
          write: vi.fn((_chunk, _encoding, callback) => callback()),
        }) as unknown as WritableResponseStream;

        const err = new Error("Error inside handler.");

        addFailWeakProp(responseStreamWithFail, async (err) => {
          processOrder.push(`fail-called-with-${(err as Error).message}`);
        });

        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockReturnValue({
            request: responseStreamWithFail,
            responseDone: Promise.resolve(),
          });

        const errorThrowingHandler = async (
          _event: unknown,
          responseStream: WritableResponseStream,
        ) => {
          processOrder.push("handler-called");
          responseStream.write("foo");
          throw err;
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: errorThrowingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 20);

        // THEN
        expect(processOrder).toEqual([
          "handler-called",
          "fail-called-with-Error inside handler.",
          "handler-called",
          "fail-called-with-Error inside handler.",
        ]);
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
      });
    });

    describe("InvokeStore integration", () => {
      it("should set requestId and traceId in InvokeStore for buffered invocations", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(-1, true);
        const storeOrder: string[] = [];

        const BufferedHandler: BufferedHandler = async () => {
          storeOrder.push(invokeStore.getRequestId());
          storeOrder.push(invokeStore.getXRayTraceId()!);
          await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work
          return "done";
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: BufferedHandler,
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 60);

        // THEN
        expect(storeOrder).toEqual([
          "test-id-1",
          "trace-id-1",
          "test-id-2",
          "trace-id-2",
        ]);
      });

      it("should set requestId and traceId in InvokeStore for streaming invocations", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3, true);
        const storeOrder: string[] = [];

        let resolveDone: (value: void | PromiseLike<void>) => void;
        const responsePromise = new Promise<void>((res) => (resolveDone = res));

        const mockResponseStream = {
          write: vi.fn().mockReturnValue(true),
          end: vi.fn(),
          writableFinished: true,
          setContentType: vi.fn(),
        };

        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockReturnValue({
            request: mockResponseStream,
            responseDone: responsePromise,
          });

        const streamingHandler: StreamingHandler = async (
          _event,
          responseStream,
        ) => {
          storeOrder.push(invokeStore.getRequestId());
          storeOrder.push(invokeStore.getXRayTraceId()!);

          responseStream.write("streaming data");
          setTimeout(() => {
            responseStream.end();
            resolveDone();
          }, 25);
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: streamingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: false,
        });

        // WHEN
        await startAndTickRuntime(runtime, 60);

        // THEN
        expect(storeOrder.slice(0, 4)).toEqual([
          "test-id-1",
          "trace-id-1",
          "test-id-2",
          "trace-id-2",
        ]);
        expect(mockResponseStream.write).toHaveBeenCalledWith("streaming data");
        expect(mockResponseStream.end).toHaveBeenCalled();
      });
    });
  });

  describe("[multi-concurrent]", () => {
    let invokeStore: Awaited<ReturnType<typeof InvokeStore.getInstanceAsync>>;

    beforeEach(async () => {
      // Set AWS_LAMBDA_MAX_CONCURRENCY to ensure InvokeStoreMulti is used
      process.env.AWS_LAMBDA_MAX_CONCURRENCY = "1";
      InvokeStore._testing?.reset?.();
      invokeStore = await InvokeStore.getInstanceAsync();
    });

    afterEach(() => {
      delete process.env.AWS_LAMBDA_MAX_CONCURRENCY;
      InvokeStore._testing?.reset();
    });
    it("should process invocations concurrently", async () => {
      // GIVEN
      const mockRapidClient = createMockRapidClient(3);
      const processOrder: string[] = [];

      const BufferedHandler: BufferedHandler = async (_event, context) => {
        const invocationNumber = processOrder.length / 2 + 1;
        processOrder.push(`${context?.awsRequestId}-start`);

        // First invocation takes longer than second
        await new Promise((resolve) =>
          setTimeout(resolve, invocationNumber === 1 ? 100 : 50),
        );

        processOrder.push(`${context?.awsRequestId}-done`);
        return "done";
      };

      const runtime = Runtime.create({
        rapidClient: mockRapidClient,
        handler: BufferedHandler,
        isMultiConcurrent: true,
      });

      // WHEN
      await startAndTickRuntime(runtime, 105);

      // THEN
      expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
      expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledTimes(2);
      expect(processOrder).toEqual([
        "test-id-1-start",
        "test-id-2-start",
        "test-id-2-done",
        "test-id-1-done",
      ]);
    });

    it("should handle concurrent errors independently", async () => {
      // GIVEN
      const mockRapidClient = createMockRapidClient(3);
      const processOrder: string[] = [];

      const BufferedHandler: BufferedHandler = async (_event, context) => {
        const invocationNumber = processOrder.length / 2 + 1;
        processOrder.push(`${context?.awsRequestId}-start`);

        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work

        if (invocationNumber === 1) {
          processOrder.push(`${context?.awsRequestId}-error`);
          throw new Error("First invocation error");
        }

        processOrder.push(`${context?.awsRequestId}-done`);
        return "done";
      };

      const runtime = Runtime.create({
        rapidClient: mockRapidClient,
        handler: BufferedHandler,
        isMultiConcurrent: true,
      });

      // WHEN
      await startAndTickRuntime(runtime, 105);

      // THEN
      expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
      expect(mockRapidClient.postInvocationError).toHaveBeenCalledTimes(1);
      expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledTimes(1);
      expect(processOrder).toEqual([
        "test-id-1-start",
        "test-id-2-start",
        "test-id-1-error",
        "test-id-2-done",
      ]);
    });

    describe("InvokeStore integration", () => {
      beforeEach(() => {
        // Forced to use real timers since async context is not carried into fakeTimers
        vi.useRealTimers();
      });

      it("should set requestId and traceId in InvokeStore for concurrent invocations", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3, true);
        const storeOrder: string[] = [];
        const completionOrder: string[] = [];

        const BufferedHandler: BufferedHandler = async () => {
          const invocationNumber = storeOrder.length / 2 + 1;

          storeOrder.push(invokeStore.getRequestId());
          storeOrder.push(invokeStore.getXRayTraceId()!);

          await new Promise((resolve) =>
            setTimeout(resolve, invocationNumber === 1 ? 10 : 5),
          );

          completionOrder.push(invokeStore.getRequestId());

          return "done";
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: BufferedHandler,
          isMultiConcurrent: true,
        });

        // WHEN
        runtime.start();
        await new Promise((resolve) => setTimeout(resolve, 20));

        // THEN
        expect(storeOrder).toEqual([
          "test-id-1",
          "trace-id-1",
          "test-id-2",
          "trace-id-2",
        ]);

        expect(completionOrder).toEqual(["test-id-2", "test-id-1"]);

        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
        expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledTimes(2);
      });

      it("should maintain context when mixing different timer types in RIC", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3, true);
        const traces: Record<string, string[]> = {
          "test-id-1": [],
          "test-id-2": [],
        };

        const mixedTimersHandler: BufferedHandler = async () => {
          const requestId = invokeStore.getRequestId();
          traces[requestId].push(`start`);

          // Queue a setTimeout that triggers setImmediate
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              traces[invokeStore.getRequestId()].push(`timeout`);

              setImmediate(() => {
                traces[invokeStore.getRequestId()].push(`immediate`);

                process.nextTick(() => {
                  traces[invokeStore.getRequestId()].push(`nextTick`);
                  resolve();
                });
              });
            }, 10);
          });

          traces[requestId].push(`end`);
          return "done";
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: mixedTimersHandler,
          isMultiConcurrent: true,
        });

        // WHEN
        runtime.start();
        await new Promise((resolve) => setTimeout(resolve, 30));

        // THEN
        for (const requestId of ["test-id-1", "test-id-2"]) {
          expect(traces[requestId]).toEqual([
            "start",
            "timeout",
            "immediate",
            "nextTick",
            "end",
          ]);
        }

        expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledTimes(2);
      });
    });

    describe("streaming handler", () => {
      it("should process streaming invocations concurrently", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3);
        const processOrder: string[] = [];
        const streamCompletionOrder: string[] = [];

        // Create separate response streams for each invocation
        const mockResponseStreams = [
          {
            write: vi.fn().mockReturnValue(true),
            end: vi.fn(),
            writableFinished: true,
            setContentType: vi.fn(),
          },
          {
            write: vi.fn().mockReturnValue(true),
            end: vi.fn(),
            writableFinished: true,
            setContentType: vi.fn(),
          },
        ];

        const resolvers: Array<(value: void | PromiseLike<void>) => void> = [];
        const responsePromises = [
          new Promise<void>((res) => resolvers.push(res)),
          new Promise<void>((res) => resolvers.push(res)),
        ];

        let streamCallCount = 0;
        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockImplementation(() => {
            const currentIndex = streamCallCount++;
            return {
              request: mockResponseStreams[currentIndex],
              responseDone: responsePromises[currentIndex],
            };
          });

        const streamingHandler: StreamingHandler = async (
          _event,
          responseStream,
          context,
        ) => {
          const invocationNumber = processOrder.length + 1;
          processOrder.push(`${context.awsRequestId}-start`);

          // First invocation takes longer than second
          const delay = invocationNumber === 1 ? 100 : 50;
          await new Promise((resolve) => setTimeout(resolve, delay));

          responseStream.write(`streaming data ${invocationNumber}`);

          setTimeout(() => {
            processOrder.push(`${context.awsRequestId}-done`);
            streamCompletionOrder.push(context.awsRequestId);
            responseStream.end();
            // Simulate RAPID closing stream in response to our .end()
            resolvers[invocationNumber - 1]();
          }, 25);
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: streamingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: true,
        });

        // WHEN
        await startAndTickRuntime(runtime, 130);

        // THEN
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
        expect(mockResponseStreams[0].write).toHaveBeenCalledExactlyOnceWith(
          "streaming data 1",
        );
        expect(mockResponseStreams[1].write).toHaveBeenCalledExactlyOnceWith(
          "streaming data 2",
        );
        expect(mockResponseStreams[0].end).toHaveBeenCalledOnce();
        expect(mockResponseStreams[1].end).toHaveBeenCalledOnce();

        // Verify concurrent execution - second invocation should complete first
        expect(processOrder).toEqual([
          "test-id-1-start",
          "test-id-2-start",
          "test-id-2-done",
          "test-id-1-done",
        ]);
        expect(streamCompletionOrder).toEqual(["test-id-2", "test-id-1"]);
      });

      it("should handle concurrent streaming errors independently", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3);
        const processOrder: string[] = [];
        const failCallOrder: string[] = [];

        // Create response streams with fail capability
        const createMockStreamWithFail = (streamId: string) => {
          const stream = new Writable({
            write: vi.fn((_chunk, _encoding, callback) => callback()),
          }) as unknown as WritableResponseStream;

          addFailWeakProp(stream, async (err) => {
            failCallOrder.push(`${streamId}-fail-${(err as Error).message}`);
          });

          return stream;
        };

        const mockResponseStreams = [
          createMockStreamWithFail("stream-1"),
          createMockStreamWithFail("stream-2"),
        ];

        // Track resolve functions for each stream's responseDone promise
        const resolvers: Array<(value: void | PromiseLike<void>) => void> = [];

        let streamCallCount = 0;
        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockImplementation(() => {
            const currentIndex = streamCallCount++;

            // Create a new promise and store its resolver
            let resolveResponse: (value: void | PromiseLike<void>) => void;
            const responsePromise = new Promise<void>((resolve) => {
              resolveResponse = resolve;
            });
            resolvers[currentIndex] = resolveResponse!;

            return {
              request: mockResponseStreams[currentIndex],
              responseDone: responsePromise,
            };
          });

        const streamingHandler: StreamingHandler = async (
          _event,
          responseStream,
          context,
        ) => {
          const invocationNumber = processOrder.length + 1;
          processOrder.push(`${context.awsRequestId}-start`);

          await new Promise((resolve) => setTimeout(resolve, 50));

          if (invocationNumber === 1) {
            processOrder.push(`${context.awsRequestId}-error`);
            // Simulate RAPID closing the stream due to error
            setTimeout(() => {
              resolvers[0](); // Resolve the first stream's responseDone
            }, 10);
            throw new Error("First streaming invocation error");
          }

          processOrder.push(`${context.awsRequestId}-done`);
          responseStream.write("success data");
          responseStream.end();

          // Simulate RAPID closing stream in response to our .end()
          setTimeout(() => {
            resolvers[1](); // Resolve the second stream's responseDone
          }, 10);
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: streamingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: true,
        });

        // WHEN
        await startAndTickRuntime(runtime, 105);

        // THEN
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
        expect(processOrder).toEqual([
          "test-id-1-start",
          "test-id-2-start",
          "test-id-1-error",
          "test-id-2-done",
        ]);
        expect(failCallOrder).toEqual([
          "stream-1-fail-First streaming invocation error",
        ]);
      });

      it("should handle concurrent unfinished streams", async () => {
        // GIVEN
        const mockRapidClient = createMockRapidClient(3);
        const processOrder: string[] = [];
        const failCallOrder: string[] = [];

        const createMockStreamWithFail = (streamId: string) => {
          const stream = new Writable({
            write: vi.fn((_chunk, _encoding, callback) => callback()),
          }) as unknown as WritableResponseStream;

          // Mock writableFinished to false to simulate unfinished stream
          Object.defineProperty(stream, "writableFinished", {
            value: false,
            writable: false,
          });

          addFailWeakProp(stream, async (err) => {
            failCallOrder.push(`${streamId}-fail-${(err as Error).message}`);
          });

          return stream;
        };

        const mockResponseStreams = [
          createMockStreamWithFail("stream-1"),
          createMockStreamWithFail("stream-2"),
        ];

        let streamCallCount = 0;
        mockRapidClient.getStreamForInvocationResponse = vi
          .fn()
          .mockImplementation(() => {
            const currentIndex = streamCallCount++;
            return {
              request: mockResponseStreams[currentIndex],
              responseDone: Promise.resolve(),
            };
          });

        const nonClosingHandler: StreamingHandler = async (
          _event,
          responseStream,
          context,
        ) => {
          processOrder.push(`${context.awsRequestId}-called`);
          responseStream.write("data without closing");
          // Intentionally not calling responseStream.end()
        };

        const runtime = Runtime.create({
          rapidClient: mockRapidClient,
          handler: nonClosingHandler,
          handlerMetadata: { streaming: true },
          isMultiConcurrent: true,
        });

        // WHEN
        await startAndTickRuntime(runtime, 60);

        // THEN
        expect(processOrder).toEqual(["test-id-1-called", "test-id-2-called"]);
        expect(failCallOrder).toEqual([
          "stream-1-fail-Response stream is not finished.",
          "stream-2-fail-Response stream is not finished.",
        ]);
        expect(mockRapidClient.nextInvocation).toHaveBeenCalledTimes(3);
      });
    });
  });
});

const baseMockInvocation: InvocationRequest = {
  bodyJson: JSON.stringify({ key: "value" }),
  headers: {
    "lambda-runtime-aws-request-id": "test-id",
    "lambda-runtime-deadline-ms": "1234567890",
    "lambda-runtime-invoked-function-arn": "test:arn",
  },
};

async function startAndTickRuntime(
  runtime: Runtime,
  timeoutMs = 100,
): Promise<void> {
  runtime.start();
  await vi.advanceTimersByTimeAsync(timeoutMs);
}

function createMockRapidClient(
  throttleAt: number = -1,
  passXRayTraceId: boolean = false,
): RAPIDClient {
  let invocationCount = 0;
  return {
    nextInvocation: vi.fn().mockImplementation(() => {
      invocationCount++;
      if (invocationCount == throttleAt) {
        return new Promise(() => {});
      }
      return Promise.resolve({
        ...baseMockInvocation,
        headers: {
          ...baseMockInvocation.headers,
          "lambda-runtime-aws-request-id": `test-id-${invocationCount}`,
          ...(passXRayTraceId
            ? {
                "lambda-runtime-trace-id": `trace-id-${invocationCount}`,
              }
            : {}),
        },
      });
    }),
    postInvocationResponse: vi.fn(async () => {}),
    postInvocationError: vi.fn(async () => {}),
    postInitError: vi.fn(async () => {}),
  } as unknown as RAPIDClient;
}
