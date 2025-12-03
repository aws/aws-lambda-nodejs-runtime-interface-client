import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LifecycleManager } from "./lifecycle-manager.js";
import { RAPIDClient } from "../client/index.js";
import type { InvocationRequest } from "../client/types.js";
import { WritableResponseStream } from "../stream/index.js";
import { Writable } from "node:stream";
import { structuredConsole } from "../logging/index.js";
import { tryCallFail } from "../stream/index.js";

vi.mock("../logging/index.js", () => ({
  logger: vi.fn(() => ({
    verbose: vi.fn(),
    vverbose: vi.fn(),
  })),
  structuredConsole: {
    logError: vi.fn(),
  },
}));

vi.mock("../stream/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stream/index.js")>();
  return {
    ...actual,
    tryCallFail: vi.fn(),
  };
});

describe("LifecycleManager", () => {
  let mockRapidClient: RAPIDClient;
  let lifecycleManager: LifecycleManager;

  beforeEach(() => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "test-function";
    process.env.AWS_LAMBDA_FUNCTION_VERSION = "1";
    process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = "128";
    process.env.AWS_LAMBDA_LOG_GROUP_NAME = "test-group";
    process.env.AWS_LAMBDA_LOG_STREAM_NAME = "test-stream";

    mockRapidClient = createMockRapidClient();
    lifecycleManager = LifecycleManager.create(mockRapidClient);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.AWS_LAMBDA_FUNCTION_VERSION;
    delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
    delete process.env.AWS_LAMBDA_LOG_GROUP_NAME;
    delete process.env.AWS_LAMBDA_LOG_STREAM_NAME;
  });

  describe("create", () => {
    it("should create a LifecycleManager instance", () => {
      const manager = LifecycleManager.create(mockRapidClient);
      expect(manager).toBeInstanceOf(LifecycleManager);
    });
  });

  describe("fail", () => {
    it("should log error and post invocation error", async () => {
      // GIVEN
      const requestId = "test-request-id";
      const error = new Error("Test error");

      // WHEN
      const promise = lifecycleManager.fail(requestId, error);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Invoke Error",
        error,
      );
      expect(mockRapidClient.postInvocationError).toHaveBeenCalledWith(
        error,
        requestId,
      );
    });

    it("should handle non-Error objects", async () => {
      // GIVEN
      const requestId = "test-request-id";
      const error = "String error";

      // WHEN
      const promise = lifecycleManager.fail(requestId, error);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Invoke Error",
        error,
      );
      expect(mockRapidClient.postInvocationError).toHaveBeenCalledWith(
        error,
        requestId,
      );
    });
  });

  describe("failResponseStream", () => {
    it("should log error and call tryCallFail on response stream", async () => {
      // GIVEN
      const mockResponseStream =
        new Writable() as unknown as WritableResponseStream;
      const error = new Error("Stream error");

      // WHEN
      const promise = lifecycleManager.failResponseStream(
        mockResponseStream,
        error,
      );
      vi.runAllTimers();
      await promise;

      // THEN
      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Invoke Error",
        error,
      );
      expect(tryCallFail).toHaveBeenCalledWith(mockResponseStream, error);
    });
  });

  describe("succeed", () => {
    it("should post invocation response", async () => {
      // GIVEN
      const requestId = "test-request-id";
      const result = { success: true };

      // WHEN
      const promise = lifecycleManager.succeed(requestId, result);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledWith(
        result,
        requestId,
      );
    });

    it("should handle undefined result", async () => {
      // GIVEN
      const requestId = "test-request-id";
      const result = undefined;

      // WHEN
      const promise = lifecycleManager.succeed(requestId, result);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledWith(
        result,
        requestId,
      );
    });

    it("should handle null result", async () => {
      // GIVEN
      const requestId = "test-request-id";
      const result = null;

      // WHEN
      const promise = lifecycleManager.succeed(requestId, result);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledWith(
        result,
        requestId,
      );
    });
  });

  describe("next", () => {
    it("should return parsed event and context from invocation request", async () => {
      // GIVEN
      const mockInvocationRequest: InvocationRequest = {
        bodyJson: JSON.stringify({ message: "test event" }),
        headers: {
          "lambda-runtime-aws-request-id": "test-request-id",
          "lambda-runtime-deadline-ms": "1234567890",
          "lambda-runtime-invoked-function-arn":
            "arn:aws:lambda:us-east-1:123456789012:function:test",
          "lambda-runtime-trace-id": "Root=1-5e1b4151-5ac6c58b526d2fa17d05146a",
        },
      };

      mockRapidClient.nextInvocation = vi
        .fn()
        .mockResolvedValue(mockInvocationRequest);

      // WHEN
      const result = await lifecycleManager.next();

      // THEN
      expect(mockRapidClient.nextInvocation).toHaveBeenCalledOnce();
      expect(result.event).toEqual({ message: "test event" });
      expect(result.context.awsRequestId).toBe("test-request-id");
      expect(result.context.xRayTraceId).toBe(
        "Root=1-5e1b4151-5ac6c58b526d2fa17d05146a",
      );
    });

    it("should handle invocation request without trace ID", async () => {
      // GIVEN
      const mockInvocationRequest: InvocationRequest = {
        bodyJson: JSON.stringify({ message: "test event" }),
        headers: {
          "lambda-runtime-aws-request-id": "test-request-id",
          "lambda-runtime-deadline-ms": "1234567890",
          "lambda-runtime-invoked-function-arn":
            "arn:aws:lambda:us-east-1:123456789012:function:test",
        },
      };

      mockRapidClient.nextInvocation = vi
        .fn()
        .mockResolvedValue(mockInvocationRequest);

      // WHEN
      const result = await lifecycleManager.next();

      // THEN
      expect(result.context.xRayTraceId).toBeUndefined();
    });

    it("should handle complex event objects", async () => {
      // GIVEN
      const complexEvent = {
        Records: [
          {
            eventVersion: "2.1",
            eventSource: "aws:s3",
            eventName: "ObjectCreated:Put",
            s3: {
              bucket: { name: "test-bucket" },
              object: { key: "test-key" },
            },
          },
        ],
      };

      const mockInvocationRequest: InvocationRequest = {
        bodyJson: JSON.stringify(complexEvent),
        headers: {
          "lambda-runtime-aws-request-id": "test-request-id",
          "lambda-runtime-deadline-ms": "1234567890",
          "lambda-runtime-invoked-function-arn":
            "arn:aws:lambda:us-east-1:123456789012:function:test",
        },
      };

      mockRapidClient.nextInvocation = vi
        .fn()
        .mockResolvedValue(mockInvocationRequest);

      // WHEN
      const result = await lifecycleManager.next();

      // THEN
      expect(result.event).toEqual(complexEvent);
    });

    it("should handle malformed JSON in event body", async () => {
      // GIVEN
      const mockInvocationRequest: InvocationRequest = {
        bodyJson: "{ invalid json",
        headers: {
          "lambda-runtime-aws-request-id": "test-request-id",
          "lambda-runtime-deadline-ms": "1234567890",
          "lambda-runtime-invoked-function-arn":
            "arn:aws:lambda:us-east-1:123456789012:function:test",
        },
      };

      mockRapidClient.nextInvocation = vi
        .fn()
        .mockResolvedValue(mockInvocationRequest);

      // WHEN & THEN
      await expect(lifecycleManager.next()).rejects.toThrow();
    });
  });

  describe("setupResponseStream", () => {
    it("should setup response stream with default options", () => {
      // GIVEN
      const requestId = "test-request-id";
      const mockRequest = new Writable() as unknown as WritableResponseStream;
      const mockResponseDone = Promise.resolve(Buffer.from("response"));

      mockRapidClient.getStreamForInvocationResponse = vi.fn().mockReturnValue({
        request: mockRequest,
        responseDone: mockResponseDone,
      });

      // WHEN
      const result = lifecycleManager.setupResponseStream(requestId);

      // THEN
      expect(
        mockRapidClient.getStreamForInvocationResponse,
      ).toHaveBeenCalledWith(requestId, undefined);
      expect(result.responseStream).toBe(mockRequest);
      expect(result.rapidResponse).toBe(mockResponseDone);
    });

    it("should setup response stream with custom options", () => {
      // GIVEN
      const requestId = "test-request-id";
      const options = { highWaterMark: 1024 };
      const mockRequest = new Writable() as unknown as WritableResponseStream;
      const mockResponseDone = Promise.resolve(Buffer.from("response"));

      mockRapidClient.getStreamForInvocationResponse = vi.fn().mockReturnValue({
        request: mockRequest,
        responseDone: mockResponseDone,
      });

      // WHEN
      const result = lifecycleManager.setupResponseStream(requestId, options);

      // THEN
      expect(
        mockRapidClient.getStreamForInvocationResponse,
      ).toHaveBeenCalledWith(requestId, options);
      expect(result.responseStream).toBe(mockRequest);
      expect(result.rapidResponse).toBe(mockResponseDone);
    });

    it("should setup response stream with empty options", () => {
      // GIVEN
      const requestId = "test-request-id";
      const options = {};
      const mockRequest = new Writable() as unknown as WritableResponseStream;
      const mockResponseDone = Promise.resolve(Buffer.from("response"));

      mockRapidClient.getStreamForInvocationResponse = vi.fn().mockReturnValue({
        request: mockRequest,
        responseDone: mockResponseDone,
      });

      // WHEN
      const result = lifecycleManager.setupResponseStream(requestId, options);

      // THEN
      expect(
        mockRapidClient.getStreamForInvocationResponse,
      ).toHaveBeenCalledWith(requestId, options);
      expect(result.responseStream).toBe(mockRequest);
      expect(result.rapidResponse).toBe(mockResponseDone);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete invocation lifecycle for success case", async () => {
      // GIVEN
      const mockInvocationRequest: InvocationRequest = {
        bodyJson: JSON.stringify({ message: "test" }),
        headers: {
          "lambda-runtime-aws-request-id": "test-request-id",
          "lambda-runtime-deadline-ms": "1234567890",
          "lambda-runtime-invoked-function-arn":
            "arn:aws:lambda:us-east-1:123456789012:function:test",
        },
      };

      mockRapidClient.nextInvocation = vi
        .fn()
        .mockResolvedValue(mockInvocationRequest);

      // WHEN
      const { context, event } = await lifecycleManager.next();
      const result = { success: true, processedEvent: event };
      const promise = lifecycleManager.succeed(context.awsRequestId, result);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(mockRapidClient.nextInvocation).toHaveBeenCalledOnce();
      expect(mockRapidClient.postInvocationResponse).toHaveBeenCalledWith(
        result,
        "test-request-id",
      );
    });

    it("should handle complete invocation lifecycle for error case", async () => {
      // GIVEN
      const mockInvocationRequest: InvocationRequest = {
        bodyJson: JSON.stringify({ message: "test" }),
        headers: {
          "lambda-runtime-aws-request-id": "test-request-id",
          "lambda-runtime-deadline-ms": "1234567890",
          "lambda-runtime-invoked-function-arn":
            "arn:aws:lambda:us-east-1:123456789012:function:test",
        },
      };

      mockRapidClient.nextInvocation = vi
        .fn()
        .mockResolvedValue(mockInvocationRequest);

      // WHEN
      const { context } = await lifecycleManager.next();
      const error = new Error("Processing failed");
      const promise = lifecycleManager.fail(context.awsRequestId, error);
      vi.runAllTimers();
      await promise;

      // THEN
      expect(mockRapidClient.nextInvocation).toHaveBeenCalledOnce();
      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Invoke Error",
        error,
      );
      expect(mockRapidClient.postInvocationError).toHaveBeenCalledWith(
        error,
        "test-request-id",
      );
    });
  });
});

function createMockRapidClient(): RAPIDClient {
  return {
    nextInvocation: vi.fn(),
    postInvocationResponse: vi.fn(),
    postInvocationError: vi.fn(),
    postInitError: vi.fn(),
    getStreamForInvocationResponse: vi.fn(),
  } as unknown as RAPIDClient;
}
