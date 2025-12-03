import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { RAPIDClient } from "./rapid-client.js";
import { type IncomingMessage, type ClientRequest, Agent } from "http";
import { EventEmitter } from "events";
import type { NativeClient, HttpClient } from "./types.js";
import { createResponseStream } from "../stream/index.js";
import Stream from "stream";
import { structuredConsole } from "../logging/index.js";

describe("RAPIDClient", () => {
  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1;
  });

  describe("nextInvocation", () => {
    it("should use native client by default", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient, mockRequest } =
        createMockedClients();

      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });

      // WHEN
      const result = await client.nextInvocation();

      // THEN
      expect(result).toEqual({
        bodyJson: '{"key": "value"}',
        headers: { "test-header": "test-value" },
      });
      expect(mockNativeClient.next).toHaveBeenCalled();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
      expect(mockRequest.on).not.toHaveBeenCalled();
      expect(mockRequest.end).not.toHaveBeenCalled();
    });

    it("should use HTTP client when alternative client is enabled", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1 = "true";

      const { mockNativeClient, mockHttpClient, mockRequest, mockResponse } =
        createMockedClients();

      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });

      // WHEN
      const result = await client.nextInvocation();

      // THEN
      expect(result).toEqual({
        bodyJson: '{"key":"value"}',
        headers: { "test-header": "test-value" },
      });
      expect(mockNativeClient.next).not.toHaveBeenCalled();
      expect(mockHttpClient.request).toHaveBeenCalled();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "mock",
          port: 8080,
          path: "/2018-06-01/runtime/invocation/next",
          method: "GET",
        }),
        expect.any(Function),
      );

      expect(mockRequest.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
      expect(mockRequest.end).toHaveBeenCalled();

      expect(mockResponse.setEncoding).toHaveBeenCalledWith("utf-8");
    });

    it("should handle native client errors", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients({
        shouldFail: true,
      });

      // WHEN
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });

      // THEN
      await expect(client.nextInvocation()).rejects.toThrow(
        "Native client error",
      );
      expect(mockNativeClient.next).toHaveBeenCalled();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should handle HTTP client errors when alternative client is enabled", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1 = "true";
      const { mockNativeClient, mockHttpClient, mockRequest } =
        createMockedClients({
          shouldFail: true,
        });

      // WHEN
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });

      // Wrap in async function to handle the rejection
      const invokeWithError = async () => {
        const promise = client.nextInvocation();
        mockRequest.emit("error", new Error("Simulated network failure"));
        await promise;
      };

      // THEN
      await expect(invokeWithError()).rejects.toThrowError(
        "Simulated network failure",
      );
      expect(mockNativeClient.next).not.toHaveBeenCalled();
      expect(mockHttpClient.request).toHaveBeenCalled();
    });

    it("should handle malformed response data", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1 = "true";
      const { mockNativeClient, mockHttpClient, mockResponse } =
        createMockedClients();

      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });

      // WHEN
      const nextInvocationPromise = client.nextInvocation();

      // Emit malformed JSON
      mockResponse.emit("data", "{malformed");
      mockResponse.emit("end");

      const result = await nextInvocationPromise;

      // THEN
      expect(result).toEqual({
        bodyJson: "{malformed",
        headers: { "test-header": "test-value" },
      });
    });

    it("should handle empty response data", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1 = "true";
      const { mockNativeClient, mockHttpClient, mockResponse } =
        createMockedClients();

      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });

      // WHEN
      const nextInvocationPromise = client.nextInvocation();

      // Emit empty response
      mockResponse.emit("end");

      // THEN
      const result = await nextInvocationPromise;
      expect(result).toEqual({
        bodyJson: "",
        headers: { "test-header": "test-value" },
      });
    });

    describe("retry mechanism in MultiConcurrent mode", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("should retry when there's a failure in MultiConcurrent mode", async () => {
        // GIVEN
        const logErrorSpy = vi
          .spyOn(structuredConsole, "logError")
          .mockImplementation(() => {});

        const { mockNativeClient, mockHttpClient } = createMockedClients({
          failureSequence: [true, false], // First call fails, second succeeds
        });

        const client = await RAPIDClient.create(
          "localhost:8080",
          {
            nativeClient: mockNativeClient,
            httpModule: mockHttpClient,
          },
          true, // MultiConcurrent mode
        );

        // WHEN
        const resultPromise = client.nextInvocation();

        await vi.runOnlyPendingTimersAsync();

        const result = await resultPromise;

        // THEN
        expect(result).toEqual({
          bodyJson: '{"key": "value"}',
          headers: { "test-header": "test-value" },
        });
        expect(mockNativeClient.next).toHaveBeenCalledTimes(2);
        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        expect(logErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("attempt 1/20"),
          expect.any(Error),
        );

        logErrorSpy.mockRestore();
      });

      it("should not retry in OD mode", async () => {
        // GIVEN
        const { mockNativeClient, mockHttpClient } = createMockedClients({
          shouldFail: true,
        });

        const client = await RAPIDClient.create(
          "localhost:8080",
          {
            nativeClient: mockNativeClient,
            httpModule: mockHttpClient,
          },
          false, // OD mode
        );

        // WHEN & THEN
        await expect(client.nextInvocation()).rejects.toThrow(
          "Native client error",
        );
        expect(mockNativeClient.next).toHaveBeenCalledTimes(1);
      });

      it("should use exponential backoff for retries", async () => {
        // GIVEN
        const logErrorSpy = vi
          .spyOn(structuredConsole, "logError")
          .mockImplementation(() => {});

        const { mockNativeClient, mockHttpClient } = createMockedClients({
          failureSequence: [true, true, true, false], // Fail 3 times then succeed
        });

        const client = await RAPIDClient.create(
          "localhost:8080",
          {
            nativeClient: mockNativeClient,
            httpModule: mockHttpClient,
          },
          true, // MultiConcurrent mode
          {
            initialDelayMs: 100,
            maxDelayMs: 5000,
            maxRetries: 3,
          },
        );

        // WHEN
        const resultPromise = client.nextInvocation();

        // Fast-forward through all retries
        await vi.runOnlyPendingTimersAsync(); // First backoff (100ms)
        await vi.runOnlyPendingTimersAsync(); // Second backoff (200ms)
        await vi.runOnlyPendingTimersAsync(); // Third backoff (400ms)

        const result = await resultPromise;

        // THEN
        expect(result).toEqual({
          bodyJson: '{"key": "value"}',
          headers: { "test-header": "test-value" },
        });
        expect(mockNativeClient.next).toHaveBeenCalledTimes(4); // Initial + 3 retries

        // Verify backoff delay messages
        expect(logErrorSpy).toHaveBeenCalledTimes(3);
        expect(logErrorSpy).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining("Retrying in 100ms"),
          expect.any(Error),
        );
        expect(logErrorSpy).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("Retrying in 200ms"),
          expect.any(Error),
        );
        expect(logErrorSpy).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining("Retrying in 400ms"),
          expect.any(Error),
        );

        logErrorSpy.mockRestore();
      });

      it("should give up after max retries", async () => {
        // GIVEN
        const logErrorSpy = vi
          .spyOn(structuredConsole, "logError")
          .mockImplementation(() => {});

        const { mockNativeClient, mockHttpClient } = createMockedClients({
          shouldFail: true,
        });

        const client = await RAPIDClient.create(
          "localhost:8080",
          {
            nativeClient: mockNativeClient,
            httpModule: mockHttpClient,
          },
          true, // MultiConcurrent mode
          {
            initialDelayMs: 100,
            maxDelayMs: 5000,
            maxRetries: 2,
          },
        );

        // WHEN
        const resultPromise = client.nextInvocation();
        const assertFailure = expect(resultPromise).rejects.toThrow(
          "Native client error",
        );

        // Fast-forward through all retries
        await vi.runAllTimersAsync(); // First backoff
        await vi.runOnlyPendingTimersAsync(); // Second backoff

        // THEN
        await assertFailure;
        expect(mockNativeClient.next).toHaveBeenCalledTimes(3); // Initial + 2 retries
        expect(logErrorSpy).toHaveBeenCalledTimes(3); // 2 retry logs + 1 giving up log
        expect(logErrorSpy).toHaveBeenLastCalledWith(
          expect.stringContaining("after 3 attempts. Giving up"),
          expect.any(Error),
        );

        logErrorSpy.mockRestore();
      });
    });
  });

  describe("postInvocationResponse", () => {
    it("should post response and call callback", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("localhost:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const response = { key: "value" };

      // WHEN
      client.postInvocationResponse(response, "request-id");

      // THEN
      expect(mockNativeClient.done).toHaveBeenCalledWith(
        "request-id",
        JSON.stringify(response),
      );
    });

    it("should URL encode the request ID", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("localhost:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const response = { key: "value" };

      // WHEN
      client.postInvocationResponse(response, "request/id with spaces");

      // THEN
      expect(mockNativeClient.done).toHaveBeenCalledWith(
        "request%2Fid%20with%20spaces",
        JSON.stringify(response),
      );
    });

    it("should throw errors in OD mode", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients({
        shouldFail: true,
      });
      const client = await RAPIDClient.create(
        "localhost:8080",
        {
          nativeClient: mockNativeClient,
          httpModule: mockHttpClient,
        },
        false,
      );

      // WHEN & THEN
      expect(() => {
        client.postInvocationResponse({ key: "value" }, "request-id");
      }).toThrow("Native client error");
    });

    it("should log error and continue in MultiConcurrent mode", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients({
        shouldFail: true,
      });
      const client = await RAPIDClient.create(
        "localhost:8080",
        {
          nativeClient: mockNativeClient,
          httpModule: mockHttpClient,
        },
        true,
      );

      const logErrorSpy = vi
        .spyOn(structuredConsole, "logError")
        .mockImplementation(() => {});

      // WHEN
      client.postInvocationResponse({ key: "value" }, "request-id");

      // THEN
      expect(logErrorSpy).toHaveBeenCalledWith(
        "Failed to post invocation response for request-id",
        new Error("Native client error"),
      );
      expect(mockNativeClient.done).toHaveBeenCalled();

      logErrorSpy.mockRestore();
    });

    it("should throw JSON stringify error in MultiConcurrent mode", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients({
        shouldFail: true,
      });
      const client = await RAPIDClient.create(
        "localhost:8080",
        {
          nativeClient: mockNativeClient,
          httpModule: mockHttpClient,
        },
        true,
      );

      // WHEN
      type Circular = { self: Circular };
      const circular: Circular = {} as Circular;
      circular.self = circular;

      // THEN
      expect(() => {
        client.postInvocationResponse(circular, "request-id");
      }).toThrow("Unable to stringify response body");
    });
  });

  describe("postInvocationError", () => {
    it("should post error response", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const error = new Error("Test error");
      error.name = "TestError";

      // WHEN
      client.postInvocationError(error, "request-id");

      // THEN
      expect(mockNativeClient.error).toHaveBeenCalledWith(
        "request-id",
        expect.stringContaining("TestError"), // error response
        expect.stringContaining("working_directory"), // xray response
      );
    });

    it("should URL encode the request ID", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const error = new Error("Test error");

      // WHEN
      client.postInvocationError(error, "request/id with spaces");

      // THEN
      expect(mockNativeClient.error).toHaveBeenCalledWith(
        "request%2Fid%20with%20spaces",
        expect.any(String),
        expect.any(String),
      );
    });

    it("should handle errors with DEL characters", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const error = new Error("Test\x7Ferror");
      error.name = "Test\x7FError";

      // WHEN
      client.postInvocationError(error, "request-id");

      // THEN
      expect(mockNativeClient.error).toHaveBeenCalledWith(
        "request-id",
        expect.stringContaining("Test%7FError"),
        expect.stringContaining("Test%7Ferror"),
      );
    });

    it("should throw errors in OD mode", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients({
        shouldFail: true,
      });
      const client = await RAPIDClient.create(
        "localhost:8080",
        {
          nativeClient: mockNativeClient,
          httpModule: mockHttpClient,
        },
        false,
      );
      const error = new Error("Test error");

      // WHEN & THEN
      expect(() => {
        client.postInvocationError(error, "request-id");
      }).toThrow("Native client error");
    });

    it("should log error and continue in MultiConcurrent mode", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients({
        shouldFail: true,
      });
      const client = await RAPIDClient.create(
        "localhost:8080",
        {
          nativeClient: mockNativeClient,
          httpModule: mockHttpClient,
        },
        true,
      );
      const error = new Error("Test error");

      const logErrorSpy = vi
        .spyOn(structuredConsole, "logError")
        .mockImplementation(() => {});

      // WHEN
      client.postInvocationError(error, "request-id");

      // THEN
      expect(logErrorSpy).toHaveBeenCalledWith(
        "Failed to post invocation error for request-id",
        new Error("Native client error"),
      );
      expect(mockNativeClient.error).toHaveBeenCalled();

      logErrorSpy.mockRestore();
    });
  });

  describe("postInitError", () => {
    it("should post initialization error", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient, mockResponse } =
        createMockedClients();
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const error = new Error("Initialization failed");
      error.name = "InitError";

      // WHEN
      await client.postInitError(error);

      // THEN
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "mock",
          port: 8080,
          path: "/2018-06-01/runtime/init/error",
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "Content-Length": expect.any(Number),
            "Lambda-Runtime-Function-Error-Type": "InitError",
          }),
        }),
        expect.any(Function),
      );

      // Simulate response completion
      mockResponse.emit("end");
    });

    it("should handle network errors during init error posting", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient, mockRequest } =
        createMockedClients();
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const error = new Error("Initialization failed");
      error.name = "InitError";

      // WHEN
      await client.postInitError(error);

      // THEN
      expect(() => {
        mockRequest.emit("error", new Error("Network error"));
      }).toThrow("Network error");
    });

    it("should handle errors with special characters", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient, mockResponse } =
        createMockedClients();
      const client = await RAPIDClient.create("mock:8080", {
        nativeClient: mockNativeClient,
        httpModule: mockHttpClient,
      });
      const error = new Error("Test\x7Ferror");
      error.name = "Test\x7FError";

      // WHEN
      client.postInitError(error);

      // THEN
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "Lambda-Runtime-Function-Error-Type": "Test%7FError",
          }),
        }),
        expect.any(Function),
      );

      // Simulate response completion
      mockResponse.emit("end");
    });
  });

  describe("getStreamForInvocationResponse", () => {
    beforeEach(() => {
      vi.mock("../stream/response-stream.js", () => ({
        createResponseStream: vi.fn(),
      }));
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should create a response stream with correct parameters", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient, agent } = createMockedClients();
      const client = await RAPIDClient.create("localhost:8080", {
        httpModule: mockHttpClient,
        nativeClient: mockNativeClient,
      });

      const { mockRequest, mockResponseDone } = mockResponseStream();

      // WHEN
      const result = client.getStreamForInvocationResponse("test-id", {
        highWaterMark: 1024,
      });

      // THEN
      expect(createResponseStream).toHaveBeenCalledWith({
        httpOptions: {
          agent: agent,
          http: mockHttpClient,
          hostname: "localhost",
          method: "POST",
          port: 8080,
          path: "/2018-06-01/runtime/invocation/test-id/response",
          highWaterMark: 1024,
        },
      });

      expect(result).toEqual({
        request: mockRequest,
        responseDone: mockResponseDone,
      });
    });

    it("should encode the invocation ID in the path", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("localhost:8080", {
        httpModule: mockHttpClient,
        nativeClient: mockNativeClient,
      });

      mockResponseStream();

      // WHEN
      client.getStreamForInvocationResponse("test/id with spaces", undefined);

      // THEN
      expect(createResponseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          httpOptions: expect.objectContaining({
            path: "/2018-06-01/runtime/invocation/test%2Fid%20with%20spaces/response",
          }),
        }),
      );
    });

    it("should handle undefined options", async () => {
      // GIVEN
      const { mockNativeClient, mockHttpClient } = createMockedClients();
      const client = await RAPIDClient.create("localhost:8080", {
        httpModule: mockHttpClient,
        nativeClient: mockNativeClient,
      });

      mockResponseStream();

      // WHEN
      client.getStreamForInvocationResponse("test-id", undefined);

      // THEN
      expect(createResponseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          httpOptions: expect.objectContaining({
            highWaterMark: undefined,
          }),
        }),
      );
    });
  });
});

function mockResponseStream() {
  const mockRequest = new Stream();
  const mockResponseDone = Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (createResponseStream as any).mockReturnValue({
    request: mockRequest,
    responseDone: mockResponseDone,
  });
  return { mockRequest, mockResponseDone };
}

function createMockedClients(
  options: {
    shouldFail?: boolean;
    failureSequence?: boolean[];
  } = {},
) {
  let nextCallCount = 0;

  const mockNativeClient: NativeClient = {
    next: options.failureSequence
      ? vi.fn().mockImplementation(() => {
          const shouldFail = options.failureSequence?.[nextCallCount] || false;
          nextCallCount++;
          if (shouldFail) {
            return Promise.reject(new Error("Native client error"));
          }
          return Promise.resolve({
            bodyJson: '{"key": "value"}',
            headers: { "test-header": "test-value" },
          });
        })
      : options.shouldFail
        ? vi.fn().mockRejectedValue(new Error("Native client error"))
        : vi.fn().mockResolvedValue({
            bodyJson: '{"key": "value"}',
            headers: { "test-header": "test-value" },
          }),
    done: options.shouldFail
      ? vi.fn().mockImplementation(() => {
          throw new Error("Native client error");
        })
      : vi.fn(),
    error: options.shouldFail
      ? vi.fn().mockImplementation(() => {
          throw new Error("Native client error");
        })
      : vi.fn(),
  };

  const mockResponse = new EventEmitter() as IncomingMessage;
  mockResponse.headers = { "test-header": "test-value" };
  mockResponse.statusCode = 200;
  mockResponse.setEncoding = vi.fn().mockReturnValue(mockResponse);

  const mockRequest = new EventEmitter() as ClientRequest;
  mockRequest.on = vi.fn().mockReturnThis();
  mockRequest.end = vi.fn();

  const agent = new Agent();

  const mockHttpClient = {
    Agent: vi.fn().mockReturnValue(agent),
    request: vi.fn().mockImplementation((_options, callback) => {
      callback(mockResponse);
      setTimeout(() => {
        mockResponse.emit("data", '{"key":');
        mockResponse.emit("data", '"value"}');
        mockResponse.emit("end");
      }, 0);
      return mockRequest;
    }),
  } as unknown as HttpClient;

  return { mockNativeClient, mockHttpClient, mockResponse, mockRequest, agent };
}
