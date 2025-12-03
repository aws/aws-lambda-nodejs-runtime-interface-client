import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelemetryLogger } from "./telemetry-logger.js";
import { LOG_FORMAT, LOG_LEVEL } from "./constants.js";
import fs from "fs";
import { InvokeStore } from "@aws/lambda-invoke-store";

describe("TelemetryLogger", async () => {
  const mockFd = 123;
  const mockTimestamp = "2024-01-01T00:00:00.000Z";
  const mockDate = new Date(mockTimestamp);
  const mockRequestId = "test-request-id";

  const invokeStore = await InvokeStore.getInstanceAsync();

  beforeEach(() => {
    vi.spyOn(fs, "writeSync").mockReturnValue(0);
    vi.spyOn(invokeStore, "getRequestId").mockReturnValue(mockRequestId);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe("text format", () => {
    it("should write text frame with correct format", () => {
      // GIVEN
      const logger = new TelemetryLogger(
        mockFd,
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test message");

      // THEN
      // Frame header call
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        1,
        mockFd,
        expect.any(Buffer),
      );

      // Message content call
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        2,
        mockFd,
        Buffer.from(
          `${mockTimestamp}\t${mockRequestId}\tINFO\ttest message\n`,
          "utf8",
        ),
      );
      expect(fs.writeSync).toHaveBeenCalledTimes(2);
    });

    it("should format text message with parameters", () => {
      // GIVEN
      const logger = new TelemetryLogger(
        mockFd,
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.INFO,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "test %s %d", "param", 42);

      // THEN
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        1,
        mockFd,
        expect.any(Buffer),
      );
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        2,
        mockFd,
        Buffer.from(
          `${mockTimestamp}\t${mockRequestId}\tINFO\ttest param 42\n`,
          "utf8",
        ),
      );
      expect(fs.writeSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("JSON format", () => {
    it("should write JSON frame with correct format", () => {
      // GIVEN
      const logger = new TelemetryLogger(
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
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        1,
        mockFd,
        expect.any(Buffer),
      );
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        2,
        mockFd,
        expect.objectContaining({
          toString: expect.any(Function),
        }),
      );
      const secondCallBuffer = (
        vi.mocked(fs.writeSync).mock.calls[1][1] as unknown as Buffer
      ).toString();
      expect(secondCallBuffer).toContain(`"timestamp":"${mockTimestamp}"`);
      expect(secondCallBuffer).toContain(`"requestId":"${mockRequestId}"`);
      expect(secondCallBuffer).toContain(`"level":"INFO"`);
      expect(secondCallBuffer).toContain(`"message":"test message"`);
    });

    it("should handle error objects in JSON format", () => {
      // GIVEN
      const logger = new TelemetryLogger(
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
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        1,
        mockFd,
        expect.any(Buffer),
      );
      expect(fs.writeSync).toHaveBeenNthCalledWith(
        2,
        mockFd,
        expect.objectContaining({
          toString: expect.any(Function),
        }),
      );
      const secondCallBuffer = (
        vi.mocked(fs.writeSync).mock.calls[1][1] as unknown as Buffer
      ).toString();
      expect(secondCallBuffer).toContain(`"timestamp":"${mockTimestamp}"`);
      expect(secondCallBuffer).toContain(`"requestId":"${mockRequestId}"`);
      expect(secondCallBuffer).toContain(`"level":"ERROR"`);
      expect(secondCallBuffer).toContain(`"message":"An error occurred`);
      expect(secondCallBuffer).toContain(`"errorType":"Error"`);
      expect(secondCallBuffer).toContain(`"errorMessage":"test error"`);
      expect(secondCallBuffer).toContain(`"stackTrace":`);
    });
  });

  describe("log level filtering", () => {
    it("should not write frames for messages below minimum level", () => {
      // GIVEN
      const logger = new TelemetryLogger(
        mockFd,
        {
          format: LOG_FORMAT.TEXT,
          minLevel: LOG_LEVEL.ERROR,
        },
        invokeStore,
      );

      // WHEN
      logger.log(LOG_LEVEL.INFO, "should not log");

      // THEN
      expect(fs.writeSync).not.toHaveBeenCalled();
    });

    it("should write frames for messages at or above minimum level", () => {
      // GIVEN
      const logger = new TelemetryLogger(
        mockFd,
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
      // 2 writes per log (header + message)
      expect(fs.writeSync).toHaveBeenCalledTimes(6);
    });
  });
});
