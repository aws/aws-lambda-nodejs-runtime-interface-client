import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HEADERS, REQUIRED_INVOKE_HEADERS } from "./constants.js";
import { ContextBuilder } from "./context-builder.js";
import * as envUtils from "../utils/env.js";

describe("ContextBuilder", () => {
  const mockValidHeaders = {
    [HEADERS.REQUEST_ID]: "test-id",
    [HEADERS.DEADLINE_MS]: "1234567890",
    [HEADERS.FUNCTION_ARN]: "test:arn",
    [HEADERS.CLIENT_CONTEXT]: '{"custom":{"value":"test"}}',
    [HEADERS.COGNITO_IDENTITY]: '{"id":"test-identity"}',
    [HEADERS.X_RAY_TRACE_ID]: "test-trace",
    [HEADERS.TENANT_ID]: "blue",
  };

  beforeEach(() => {
    // Setup required environment variables
    process.env.AWS_LAMBDA_FUNCTION_NAME = "test-function";
    process.env.AWS_LAMBDA_FUNCTION_VERSION = "1";
    process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = "128";
    process.env.AWS_LAMBDA_LOG_GROUP_NAME = "test-group";
    process.env.AWS_LAMBDA_LOG_STREAM_NAME = "test-stream";

    vi.spyOn(envUtils, "moveXRayHeaderToEnv");
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.AWS_LAMBDA_FUNCTION_VERSION;
    delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
    delete process.env.AWS_LAMBDA_LOG_GROUP_NAME;
    delete process.env.AWS_LAMBDA_LOG_STREAM_NAME;

    vi.restoreAllMocks();
  });

  describe("build", () => {
    it("should build context with valid headers and environment", () => {
      // WHEN
      const context = ContextBuilder.build(mockValidHeaders);

      // THEN
      expect(context).toEqual({
        // Environment data
        functionName: "test-function",
        functionVersion: "1",
        memoryLimitInMB: "128",
        logGroupName: "test-group",
        logStreamName: "test-stream",

        // Header data
        clientContext: { custom: { value: "test" } },
        identity: { id: "test-identity" },
        invokedFunctionArn: mockValidHeaders[HEADERS.FUNCTION_ARN],
        awsRequestId: mockValidHeaders[HEADERS.REQUEST_ID],
        xRayTraceId: "test-trace",
        tenantId: "blue",

        // Methods
        getRemainingTimeInMillis: expect.any(Function),
        w3c: expect.any(Function),
      });
    });

    it("should throw error for missing environment variables", () => {
      // GIVEN
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;

      // WHEN/THEN
      expect(() => ContextBuilder.build(mockValidHeaders)).toThrow(
        "Missing required environment variables: AWS_LAMBDA_FUNCTION_NAME",
      );
    });

    it("should throw error for missing required headers", () => {
      // GIVEN
      const invalidHeaders: Partial<typeof mockValidHeaders> = {
        ...mockValidHeaders,
      };
      delete invalidHeaders[REQUIRED_INVOKE_HEADERS.REQUEST_ID];

      // WHEN/THEN
      expect(() => ContextBuilder.build(invalidHeaders)).toThrow(
        `Missing required headers: ${REQUIRED_INVOKE_HEADERS.REQUEST_ID}`,
      );
    });

    it("should handle case-insensitive headers", () => {
      // GIVEN
      const mixedCaseHeaders = {
        "Lambda-Runtime-AWS-Request-ID": mockValidHeaders[HEADERS.REQUEST_ID],
        "LAMBDA-RUNTIME-DEADLINE-MS": mockValidHeaders[HEADERS.DEADLINE_MS],
        "lambda-runtime-invoked-function-arn":
          mockValidHeaders[HEADERS.FUNCTION_ARN],
      };

      // WHEN/THEN
      const context = ContextBuilder.build(mixedCaseHeaders);

      // THEN
      expect(context).toEqual(
        expect.objectContaining({
          awsRequestId: mockValidHeaders[HEADERS.REQUEST_ID],
          invokedFunctionArn: mockValidHeaders[HEADERS.FUNCTION_ARN],
          getRemainingTimeInMillis: expect.any(Function),
        }),
      );
    });

    it("should throw error for invalid deadline", () => {
      // GIVEN
      const invalidHeaders = {
        ...mockValidHeaders,
        [HEADERS.DEADLINE_MS]: "not-a-number",
      };

      // WHEN/THEN
      expect(() => ContextBuilder.build(invalidHeaders)).toThrow(
        "Invalid deadline timestamp",
      );
    });

    it("should handle missing optional headers", () => {
      // GIVEN
      const minimalHeaders = {
        [HEADERS.REQUEST_ID]: mockValidHeaders[HEADERS.REQUEST_ID],
        [HEADERS.DEADLINE_MS]: mockValidHeaders[HEADERS.DEADLINE_MS],
        [HEADERS.FUNCTION_ARN]: mockValidHeaders[HEADERS.FUNCTION_ARN],
      };

      // WHEN
      const context = ContextBuilder.build(minimalHeaders);

      // THEN
      expect(context.clientContext).toBeUndefined();
      expect(context.identity).toBeUndefined();
    });

    it("should handle invalid JSON in optional headers", () => {
      // GIVEN
      const invalidJsonHeaders = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: "{invalid-json}",
      };

      // WHEN/THEN
      expect(() => ContextBuilder.build(invalidJsonHeaders)).toThrow(
        "Failed to parse lambda-runtime-client-context as JSON",
      );
    });

    it("should call moveXRayHeaderToEnv with headers", () => {
      // WHEN
      const context = ContextBuilder.build(mockValidHeaders);

      // THEN
      expect(context).toEqual(
        expect.objectContaining({
          awsRequestId: "test-id",
        }),
      );
      expect(envUtils.moveXRayHeaderToEnv).toHaveBeenCalled();
    });

    it("should create context without X-Ray trace ID", () => {
      // GIVEN
      const headersWithoutTrace: Record<string, string> = {
        ...mockValidHeaders,
      };
      delete headersWithoutTrace[HEADERS.X_RAY_TRACE_ID];

      // WHEN
      const context = ContextBuilder.build(headersWithoutTrace);

      // THEN
      expect(context).toEqual(
        expect.objectContaining({
          awsRequestId: "test-id",
        }),
      );
      expect(envUtils.moveXRayHeaderToEnv).toHaveBeenCalled();
    });
  });

  describe("w3c", () => {
    it("should return {} when no clientContext header is provided", () => {
      // GIVEN
      const headersWithoutClientContext: Record<string, string> = {
        ...mockValidHeaders,
      };
      delete headersWithoutClientContext[HEADERS.CLIENT_CONTEXT];

      // WHEN
      const context = ContextBuilder.build(headersWithoutClientContext);

      // THEN
      expect(context.w3c()).toEqual({});
    });

    it("should return {} when clientContext has no w3c key", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({ custom: { value: "test" } }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({});
      // clientContext is untouched when there was nothing to strip
      expect(context.clientContext).toEqual({ custom: { value: "test" } });
    });

    it("should return {baggage:'abc'} when only baggage is set", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: { baggage: "abc" },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({ baggage: "abc" });
    });

    it("should return every w3c field carried on clientContext", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          custom: { value: "test" },
          w3c: {
            traceparent:
              "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
            tracestate: "rojo=00f067aa0ba902b7",
            baggage: "userId=alice",
          },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({
        traceparent:
          "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        tracestate: "rojo=00f067aa0ba902b7",
        baggage: "userId=alice",
      });
    });

    it("should remove the source clientContext.w3c (and nested fields) after construction", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          custom: { value: "test" },
          w3c: {
            traceparent:
              "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
            baggage: "userId=alice",
          },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.clientContext).toBeDefined();
      expect(context.clientContext).not.toHaveProperty("w3c");
      expect(
        (context.clientContext as Record<string, unknown>)["w3c"],
      ).toBeUndefined();
      // Sibling clientContext fields are preserved
      expect(context.clientContext).toEqual({ custom: { value: "test" } });
    });

    it("should ignore non-string w3c field values while still stripping the source", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: {
            baggage: "abc",
            traceparent: 42, // wrong type — must be dropped
            tracestate: null, // wrong type — must be dropped
          },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({ baggage: "abc" });
      expect(context.clientContext).not.toHaveProperty("w3c");
    });

    it("should treat a non-object w3c value as empty and still strip the source", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: "not-an-object",
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({});
      expect(context.clientContext).not.toHaveProperty("w3c");
    });

    it("should treat an array w3c value as empty and still strip the source", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: ["baggage=abc"],
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({});
      expect(context.clientContext).not.toHaveProperty("w3c");
    });

    it("should return a fresh copy so callers cannot mutate the underlying map", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: { baggage: "abc" },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);
      const first = context.w3c();
      first["baggage"] = "tampered";
      first["injected"] = "nope";

      // THEN
      expect(context.w3c()).toEqual({ baggage: "abc" });
    });

    it("should only surface the allowlisted fields (traceparent, tracestate, baggage)", () => {
      // GIVEN — every allowlisted field set, plus a non-allowlisted one
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: {
            traceparent:
              "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
            tracestate: "rojo=00f067aa0ba902b7",
            baggage: "userId=alice",
          },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({
        traceparent:
          "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        tracestate: "rojo=00f067aa0ba902b7",
        baggage: "userId=alice",
      });
    });

    it("should drop non-allowlisted w3c keys even when the value is a valid string", () => {
      // GIVEN
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: {
            baggage: "keep=me",
            // Non-allowlisted keys — must NOT be surfaced by w3c()
            unknownField: "should-not-appear",
            "x-custom-trace": "should-not-appear",
            __proto__: "should-not-appear",
            constructor: "should-not-appear",
            toString: "should-not-appear",
          },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({ baggage: "keep=me" });
      // Source is still stripped regardless
      expect(context.clientContext).not.toHaveProperty("w3c");
    });

    it("should omit allowlisted keys when they are absent (no undefined leaks)", () => {
      // GIVEN — only baggage present
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: { baggage: "abc" },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      const result = context.w3c();
      expect(result).toEqual({ baggage: "abc" });
      expect("traceparent" in result).toBe(false);
      expect("tracestate" in result).toBe(false);
    });

    it("should drop allowlisted keys whose value is not a string", () => {
      // GIVEN — every allowlisted key present, but with wrong types
      const headers = {
        ...mockValidHeaders,
        [HEADERS.CLIENT_CONTEXT]: JSON.stringify({
          w3c: {
            traceparent: 42,
            tracestate: null,
            baggage: { nested: "no" },
          },
        }),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.w3c()).toEqual({});
      expect(context.clientContext).not.toHaveProperty("w3c");
    });
  });

  describe("getRemainingTimeInMillis", () => {
    it("should calculate remaining time correctly", () => {
      // GIVEN
      const now = Date.now();
      const deadline = now + 1000; // 1 second in the future
      const headers = {
        ...mockValidHeaders,
        [HEADERS.DEADLINE_MS]: deadline.toString(),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      const remaining = context.getRemainingTimeInMillis();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    it("should return negative value when deadline has passed", () => {
      // GIVEN
      const pastDeadline = Date.now() - 1000; // 1 second in the past
      const headers = {
        ...mockValidHeaders,
        [HEADERS.DEADLINE_MS]: pastDeadline.toString(),
      };

      // WHEN
      const context = ContextBuilder.build(headers);

      // THEN
      expect(context.getRemainingTimeInMillis()).toBeLessThan(0);
      expect(context.getRemainingTimeInMillis()).toBeGreaterThanOrEqual(-1200);
    });
  });
});
