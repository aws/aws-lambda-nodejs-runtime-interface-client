import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SocketLogger } from "./socket-logger.js";
import { LOG_FORMAT, LOG_LEVEL } from "./constants.js";
import { InvokeStore } from "@aws/lambda-invoke-store";

vi.mock("module", () => {
  const mockWriteSync = vi.fn();
  const mockFormat = vi.fn((msg, ...args) => {
    // Simple string formatting for %s and %d
    let result = String(msg);
    let argIndex = 0;
    result = result.replace(/%[sd]/g, () => {
      return argIndex < args.length ? String(args[argIndex++]) : "";
    });
    return result;
  });
  return {
    createRequire: () => (module: string) => {
      if (module === "node:fs") {
        return { writeSync: mockWriteSync };
      }
      if (module === "node:util") {
        return { format: mockFormat };
      }
      return vi.importActual(module);
    },
  };
});

describe("SocketLogger", async () => {
  const invokeStore = await InvokeStore.getInstanceAsync();

  const originalDateToISOString = Date.prototype.toISOString;
  const mockTimestamp = "2024-01-01T00:00:00.000Z";
  const mockRequestId = "test-request-id";
  const mockFd = 42;

  let mockWriteSync: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Get the mocked writeSync function
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const fs = require("node:fs");
    mockWriteSync = fs.writeSync;

    mockWriteSync.mockClear();
    mockWriteSync.mockImplementation(() => 0);
    Date.prototype.toISOString = vi.fn(() => mockTimestamp);
    vi.spyOn(invokeStore, "getRequestId").mockReturnValue(mockRequestId);
  });

  afterEach(() => {
    Date.prototype.toISOString = originalDateToISOString;
    vi.resetAllMocks();
  });

  describe("JSON format logging", () => {
    it("should log JSON message with proper format", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test message");

      // THEN
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining(`"timestamp":"${mockTimestamp}"`),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining(`"requestId":"${mockRequestId}"`),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"level":"INFO"'),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"message":"test message"'),
      );
    });

    it("should format message with parameters", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test %s %d", "param", 42);

      // THEN
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"message":"test param 42"'),
      );
    });

    it("should handle error objects in JSON format", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
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
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining(`"timestamp":"${mockTimestamp}"`),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining(`"requestId":"${mockRequestId}"`),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"level":"ERROR"'),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"message":"An error occurred'),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"errorType":"Error"'),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"errorMessage":"test error"'),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"stackTrace":["Error: test error",'),
      );
      expect(mockWriteSync).toHaveBeenCalledTimes(1);
    });

    it("should replace newlines with carriage returns", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "line1\nline2\nline3");

      // THEN
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining("line1\\nline2\\nline3"), // JSON escapes \n as \\n
      );
    });

    it("should handle complex objects", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );
      const complexObject = { key: "value", nested: { array: [1, 2, 3] } };

      // WHEN
      logger.log(LOG_LEVEL.INFO, complexObject);

      // THEN
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"key":"value"'),
      );
      expect(mockWriteSync).toHaveBeenCalledWith(
        mockFd,
        expect.stringContaining('"nested":{"array":[1,2,3]}'),
      );
    });
  });

  describe("log level filtering", () => {
    it("should not log messages below minimum level", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.ERROR,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "should not log");

      // THEN
      expect(mockWriteSync).not.toHaveBeenCalled();
    });

    it("should log messages at or above minimum level", () => {
      // GIVEN
      const logger = new SocketLogger(
        mockFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "should log");
      logger.log(LOG_LEVEL.WARN, "should also log");
      logger.log(LOG_LEVEL.ERROR, "should definitely log");

      // THEN
      expect(mockWriteSync).toHaveBeenCalledTimes(3);
    });
  });

  describe("file descriptor usage", () => {
    it("should write to correct file descriptor", () => {
      // GIVEN
      const customFd = 123;
      const logger = new SocketLogger(
        customFd,
        {
          format: LOG_FORMAT.JSON,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test message");

      // THEN
      expect(mockWriteSync).toHaveBeenCalledWith(customFd, expect.any(String));
    });
  });
});
