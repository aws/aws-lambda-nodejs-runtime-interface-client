import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StdoutLogger } from "./stdout-logger.js";
import { LOG_FORMAT, LOG_LEVEL } from "./constants.js";
import { InvokeStore } from "@aws/lambda-invoke-store";

describe("StdoutLogger", async () => {
  const originalStdoutWrite = process.stdout.write;
  const originalDateToISOString = Date.prototype.toISOString;
  const mockTimestamp = "2024-01-01T00:00:00.000Z";
  const mockRequestId = "test-request-id";

  const invokeStore = await InvokeStore.getInstanceAsync();

  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    Date.prototype.toISOString = vi.fn(() => mockTimestamp);
    vi.spyOn(invokeStore, "getRequestId").mockReturnValue(mockRequestId);
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    Date.prototype.toISOString = originalDateToISOString;
    vi.resetAllMocks();
  });

  describe("text format", () => {
    it("should log text message with proper format", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        `${mockTimestamp}\t${mockRequestId}\tINFO\ttest message\n`,
      );
    });

    it("should format message with parameters", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test %s %d", "param", 42);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        `${mockTimestamp}\t${mockRequestId}\tINFO\ttest param 42\n`,
      );
    });

    it("should replace newlines with carriage returns", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "line1\nline2\nline3");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        `${mockTimestamp}\t${mockRequestId}\tINFO\tline1\rline2\rline3\n`,
      );
    });

    it("should handle complex objects", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );
      const complexObject = { key: "value", nested: { array: [1, 2, 3] } };

      // WHEN
      logger.log(LOG_LEVEL.INFO, complexObject);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(
          "{ key: 'value', nested: { array: [ 1, 2, 3 ] } }",
        ),
      );
    });
  });

  describe("JSON format", () => {
    it("should log JSON message with proper format", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"timestamp":"' + mockTimestamp + '"'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"' + mockRequestId + '"'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"INFO"'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"test message"'),
      );
    });

    it("should handle error objects in JSON format", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.ERROR,
        },
        invokeStore,
      );
      const error = new Error("test error");

      // WHEN
      logger.log(LOG_LEVEL.ERROR, "An error occurred", error);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"timestamp":"${mockTimestamp}"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"requestId":"${mockRequestId}"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"ERROR"'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"An error occurred'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"errorType":"Error"'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"errorMessage":"test error"'),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"stackTrace":["Error: test error",'),
      );
      expect(process.stdout.write).toHaveBeenCalledTimes(1);
    });

    it("should handle newlines in JSON", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "line1\nline2\nline3");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`line1\\nline2\\nline3`),
      );
    });
  });

  describe("log level filtering", () => {
    it("should not log messages below minimum level", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.ERROR,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "should not log");

      // THEN
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("should log messages at or above minimum level", () => {
      // GIVEN
      const logger = new StdoutLogger(
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "should log");
      logger.log(LOG_LEVEL.WARN, "should also log");
      logger.log(LOG_LEVEL.ERROR, "should definitely log");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledTimes(3);
    });
  });
});
