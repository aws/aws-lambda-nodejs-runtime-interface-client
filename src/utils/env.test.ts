import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  consumeTelemetryFd,
  determineLogFormat,
  determineLogLevel,
  isMultiConcurrentMode,
  moveXRayHeaderToEnv,
  shouldUseAlternativeClient,
} from "./env.js";
import { LOG_FORMAT, LOG_LEVEL } from "../logging/index.js";
import { HEADERS } from "../context/constants.js";
import { InvokeHeaders } from "../context/index.js";

describe("env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("shouldUseAlternativeClient", () => {
    it('should return true when env variable is set to "true"', () => {
      // GIVEN
      process.env["AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1"] = "true";

      // WHEN
      const result = shouldUseAlternativeClient();

      // THEN
      expect(result).toBe(true);
    });

    it("should return false when env variable is set to any other value", () => {
      // GIVEN
      process.env["AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1"] = "false";

      // WHEN
      const result = shouldUseAlternativeClient();

      // THEN
      expect(result).toBe(false);
    });

    it("should return false when env variable is not set", () => {
      // GIVEN
      delete process.env["AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1"];

      // WHEN
      const result = shouldUseAlternativeClient();

      // THEN
      expect(result).toBe(false);
    });
  });

  describe("determineLogFormat", () => {
    it("should return JSON format when env var is set to JSON", () => {
      // GIVEN
      process.env["AWS_LAMBDA_LOG_FORMAT"] = "JSON";

      // WHEN
      const result = determineLogFormat();

      // THEN
      expect(result).toBe(LOG_FORMAT.JSON);
    });

    it("should handle case-insensitive JSON format", () => {
      // GIVEN
      process.env["AWS_LAMBDA_LOG_FORMAT"] = "json";

      // WHEN
      const result = determineLogFormat();

      // THEN
      expect(result).toBe(LOG_FORMAT.JSON);
    });

    it("should return TEXT format when env var is not set", () => {
      // GIVEN
      delete process.env["AWS_LAMBDA_LOG_FORMAT"];

      // WHEN
      const result = determineLogFormat();

      // THEN
      expect(result).toBe(LOG_FORMAT.TEXT);
    });

    it("should return TEXT format for any value other than JSON", () => {
      // GIVEN
      const invalidValues = ["TEXT", "INVALID", "123", ""];

      // WHEN & THEN
      invalidValues.forEach((value) => {
        process.env["AWS_LAMBDA_LOG_FORMAT"] = value;
        expect(determineLogFormat()).toBe(LOG_FORMAT.TEXT);
      });
    });
  });

  describe("determineLogLevel", () => {
    it("should return specified log level when valid", () => {
      // GIVEN
      const testCases = Object.keys(LOG_LEVEL);

      // WHEN & THEN
      testCases.forEach((level) => {
        process.env["AWS_LAMBDA_LOG_LEVEL"] = level;
        expect(determineLogLevel()).toBe(
          LOG_LEVEL[level as keyof typeof LOG_LEVEL],
        );
      });
    });

    it("should handle case-insensitive log levels", () => {
      // GIVEN
      process.env["AWS_LAMBDA_LOG_LEVEL"] = "debug";

      // WHEN
      const result = determineLogLevel();

      // THEN
      expect(result).toBe(LOG_LEVEL.DEBUG);
    });

    it("should return TRACE level when env var is not set", () => {
      // GIVEN
      delete process.env["AWS_LAMBDA_LOG_LEVEL"];

      // WHEN
      const result = determineLogLevel();

      // THEN
      expect(result).toBe(LOG_LEVEL.TRACE);
    });

    it("should return TRACE level for invalid values", () => {
      // GIVEN
      const invalidValues = ["INVALID", "LOG", "123", ""];

      // WHEN & THEN
      invalidValues.forEach((value) => {
        process.env["AWS_LAMBDA_LOG_LEVEL"] = value;
        expect(determineLogLevel()).toBe(LOG_LEVEL.TRACE);
      });
    });

    it("should preserve log level metadata", () => {
      // GIVEN
      process.env["AWS_LAMBDA_LOG_LEVEL"] = "DEBUG";

      // WHEN
      const result = determineLogLevel();

      // THEN
      expect(result).toEqual(
        expect.objectContaining({
          name: "DEBUG",
          priority: LOG_LEVEL.DEBUG.priority,
          tlvMask: LOG_LEVEL.DEBUG.tlvMask,
        }),
      );
    });
  });

  describe("consumeTelemetryFd", () => {
    it("should return undefined when env var is not set", () => {
      // GIVEN
      delete process.env["_LAMBDA_TELEMETRY_LOG_FD"];

      // WHEN
      const result = consumeTelemetryFd();

      // THEN
      expect(result).toBeUndefined();
      expect(process.env["_LAMBDA_TELEMETRY_LOG_FD"]).toBeUndefined();
    });

    it("should return number when valid integer is set", () => {
      // GIVEN
      process.env["_LAMBDA_TELEMETRY_LOG_FD"] = "42";

      // WHEN
      const result = consumeTelemetryFd();

      // THEN
      expect(result).toBe(42);
      expect(process.env["_LAMBDA_TELEMETRY_LOG_FD"]).toBeUndefined();
    });

    it("should return undefined for negative integers", () => {
      // GIVEN
      process.env["_LAMBDA_TELEMETRY_LOG_FD"] = "-1";

      // WHEN
      const result = consumeTelemetryFd();

      // THEN
      expect(result).toBeUndefined();
      expect(process.env["_LAMBDA_TELEMETRY_LOG_FD"]).toBeUndefined();
    });

    it("should return undefined for invalid values", () => {
      // GIVEN
      const invalidValues = ["not-a-number", "3.14", "null", "undefined"];

      // WHEN & THEN
      invalidValues.forEach((value) => {
        process.env["_LAMBDA_TELEMETRY_LOG_FD"] = value;
        expect(consumeTelemetryFd()).toBeUndefined();
        expect(process.env["_LAMBDA_TELEMETRY_LOG_FD"]).toBeUndefined();
      });
    });
  });

  describe("isMultiConcurrentMode", () => {
    it("should return true when AWS_LAMBDA_MAX_CONCURRENCY is set", () => {
      // GIVEN
      process.env["AWS_LAMBDA_MAX_CONCURRENCY"] = "5";

      // WHEN
      const result = isMultiConcurrentMode();

      // THEN
      expect(result).toBe(true);
    });

    it("should return true when AWS_LAMBDA_MAX_CONCURRENCY is set to empty string", () => {
      // GIVEN
      process.env["AWS_LAMBDA_MAX_CONCURRENCY"] = "";

      // WHEN
      const result = isMultiConcurrentMode();

      // THEN
      expect(result).toBe(true);
    });

    it("should return false when AWS_LAMBDA_MAX_CONCURRENCY is not set", () => {
      // GIVEN
      delete process.env["AWS_LAMBDA_MAX_CONCURRENCY"];

      // WHEN
      const result = isMultiConcurrentMode();

      // THEN
      expect(result).toBe(false);
    });
  });

  describe("moveXRayHeaderToEnv", () => {
    it("should set X-Ray trace ID in environment when present in headers", () => {
      // GIVEN
      const headers: InvokeHeaders = {
        [HEADERS.REQUEST_ID]: "test-id",
        [HEADERS.DEADLINE_MS]: "123456789",
        [HEADERS.FUNCTION_ARN]: "test:arn",
        [HEADERS.X_RAY_TRACE_ID]:
          "Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1",
      };

      // WHEN
      moveXRayHeaderToEnv(headers);

      // THEN
      expect(process.env["_X_AMZN_TRACE_ID"]).toBe(
        "Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1",
      );
    });

    it("should remove X-Ray trace ID from environment when not present in headers", () => {
      // GIVEN
      process.env["_X_AMZN_TRACE_ID"] = "old-trace-id";
      const headers: InvokeHeaders = {
        [HEADERS.REQUEST_ID]: "test-id",
        [HEADERS.DEADLINE_MS]: "123456789",
        [HEADERS.FUNCTION_ARN]: "test:arn",
      };

      // WHEN
      moveXRayHeaderToEnv(headers);

      // THEN
      expect(process.env["_X_AMZN_TRACE_ID"]).toBeUndefined();
    });

    it("should override existing X-Ray trace ID in environment", () => {
      // GIVEN
      process.env["_X_AMZN_TRACE_ID"] = "old-trace-id";
      const headers: InvokeHeaders = {
        [HEADERS.REQUEST_ID]: "test-id",
        [HEADERS.DEADLINE_MS]: "123456789",
        [HEADERS.FUNCTION_ARN]: "test:arn",
        [HEADERS.X_RAY_TRACE_ID]: "new-trace-id",
      };

      // WHEN
      moveXRayHeaderToEnv(headers);

      // THEN
      expect(process.env["_X_AMZN_TRACE_ID"]).toBe("new-trace-id");
    });

    it("should not overrid existing X-Ray trace ID in MultiConcurrent mode", () => {
      // GIVEN
      process.env["_X_AMZN_TRACE_ID"] = "old-trace-id";
      process.env["AWS_LAMBDA_MAX_CONCURRENCY"] = "5";
      const headers: InvokeHeaders = {
        [HEADERS.REQUEST_ID]: "test-id",
        [HEADERS.DEADLINE_MS]: "123456789",
        [HEADERS.FUNCTION_ARN]: "test:arn",
        [HEADERS.X_RAY_TRACE_ID]: "new-trace-id",
      };

      // WHEN
      moveXRayHeaderToEnv(headers);

      // THEN
      expect(process.env["_X_AMZN_TRACE_ID"]).toBe("old-trace-id");
    });
  });
});
