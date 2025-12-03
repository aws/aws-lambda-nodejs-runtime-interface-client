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
