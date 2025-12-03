import { describe, it, expect } from "vitest";
import { formatTextMessage, formatJsonMessage } from "./formatter.js";
import { LOG_LEVEL } from "./constants.js";

describe("formatters", () => {
  const timestamp = "2024-01-01T00:00:00.000Z";
  const requestId = "test-request-id";
  const tenantId = "test-tenant-id";
  const level = LOG_LEVEL.INFO;

  describe("formatTextMessage", () => {
    it("should format simple message", () => {
      // WHEN
      const result = formatTextMessage(
        timestamp,
        requestId,
        level,
        "test message",
      );

      // THEN
      expect(result).toBe(
        "2024-01-01T00:00:00.000Z	test-request-id	INFO	test message",
      );
    });

    it("should format message with parameters", () => {
      // WHEN
      const result = formatTextMessage(
        timestamp,
        requestId,
        level,
        "test %s %d",
        "param",
        42,
      );

      // THEN
      expect(result).toBe(
        "2024-01-01T00:00:00.000Z	test-request-id	INFO	test param 42",
      );
    });

    it("should handle objects", () => {
      // GIVEN
      const obj = { key: "value" };

      // WHEN
      const result = formatTextMessage(timestamp, requestId, level, obj);

      // THEN
      expect(result).toBe(
        "2024-01-01T00:00:00.000Z	test-request-id	INFO	{ key: 'value' }",
      );
    });
  });

  describe("formatJsonMessage", () => {
    it("should format simple message without params", () => {
      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        "test message",
      );

      // THEN
      expect(result).toEqual(
        '{"timestamp":"2024-01-01T00:00:00.000Z","level":"INFO","requestId":"test-request-id","tenantId":"test-tenant-id","message":"test message"}',
      );
    });

    it("should format message with parameters", () => {
      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        "test %s %d",
        "param",
        42,
      );

      // THEN
      expect(result).toEqual(
        '{"timestamp":"2024-01-01T00:00:00.000Z","level":"INFO","requestId":"test-request-id","tenantId":"test-tenant-id","message":"test param 42"}',
      );
    });

    it("should handle error in message", () => {
      // GIVEN
      const error = new Error("test error");
      error.stack = "Error: test error\n    at Test.stack";

      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        error,
      );

      // THEN
      expect(result).toEqual(
        '{"timestamp":"2024-01-01T00:00:00.000Z","level":"INFO","requestId":"test-request-id","tenantId":"test-tenant-id","message":{"errorType":"Error","errorMessage":"test error","stackTrace":["Error: test error","    at Test.stack"]}}',
      );
    });

    it("should handle error in params", () => {
      // GIVEN
      const error = new Error("test error");
      error.stack = "Error: test error\n    at Test.stack";

      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        "Error at: %s",
        error,
      );

      // THEN
      expect(result).toEqual(
        '{"timestamp":"2024-01-01T00:00:00.000Z","level":"INFO","requestId":"test-request-id","tenantId":"test-tenant-id","message":"Error at: Error: test error\\n    at Test.stack","errorType":"Error","errorMessage":"test error","stackTrace":["Error: test error","    at Test.stack"]}',
      );
    });

    it("should handle non-stringifiable message", () => {
      // GIVEN
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circular: any = {};
      circular.self = circular;

      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        circular,
      );

      // THEN
      expect(result).toEqual(
        '{"timestamp":"2024-01-01T00:00:00.000Z","level":"INFO","requestId":"test-request-id","tenantId":"test-tenant-id","message":"<ref *1> { self: [Circular *1] }"}',
      );
    });

    it("should handle custom error types", () => {
      // GIVEN
      class CustomError extends Error {
        public constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const error = new CustomError("custom error");

      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        "Error:",
        error,
      );

      // THEN
      const record = JSON.parse(result);

      expect(record.timestamp).toEqual("2024-01-01T00:00:00.000Z");
      expect(record.level).toEqual("INFO");
      expect(record.requestId).toEqual("test-request-id");
      expect(record.tenantId).toEqual("test-tenant-id");
      expect(record.message).toContain("Error: CustomError: custom error");
      expect(record.errorType).toContain("CustomError");
      expect(record.stackTrace).toBeInstanceOf(Array);
      expect(record.stackTrace).toContain("CustomError: custom error");
    });

    it("should handle error without stack", () => {
      // GIVEN
      const error = new Error("test error");
      error.stack = undefined;

      // WHEN
      const result = formatJsonMessage(
        timestamp,
        requestId,
        tenantId,
        level,
        tenantId,
        "Error:",
        error,
      );

      // THEN
      expect(JSON.parse(result)).toEqual(
        expect.objectContaining({
          errorType: "Error",
          errorMessage: "test error",
          stackTrace: [],
        }),
      );
    });
  });
});
