import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LogPatch, structuredConsole } from "./log-patch.js";
import * as utils from "../utils/env.js";
import * as socketUtils from "../utils/socket.js";
import { LOG_FORMAT, LOG_LEVEL } from "./constants.js";
import fs from "fs";
import { InvokeStore } from "@aws/lambda-invoke-store";

describe("LogPatch", async () => {
  const originalConsole = { ...console };
  const mockTimestamp = "2024-01-01T00:00:00.000Z";
  const mockRequestId = "test-request-id";

  const invokeStore = await InvokeStore.getInstanceAsync();

  beforeEach(() => {
    // Reset console
    Object.assign(console, originalConsole);

    // Mock stdout
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    // Mock fs
    vi.spyOn(fs, "writeSync").mockReturnValue(0);

    // Mock InvokeStore
    vi.spyOn(invokeStore, "getRequestId").mockReturnValue(mockRequestId);

    // Mock Date
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(mockTimestamp);

    // Mock env utils
    vi.spyOn(utils, "determineLogFormat").mockReturnValue(LOG_FORMAT.TEXT);
    vi.spyOn(utils, "determineLogLevel").mockReturnValue(LOG_LEVEL.INFO);
    vi.spyOn(utils, "consumeTelemetryFd").mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    Object.assign(console, originalConsole);
  });

  describe("console patching", () => {
    it("should patch all console methods", async () => {
      // WHEN
      await LogPatch.patchConsole();

      // THEN
      expect(console.log).not.toBe(originalConsole.log);
      expect(console.info).not.toBe(originalConsole.info);
      expect(console.warn).not.toBe(originalConsole.warn);
      expect(console.error).not.toBe(originalConsole.error);
      expect(console.debug).not.toBe(originalConsole.debug);
      expect(console.trace).not.toBe(originalConsole.trace);
      expect(console.fatal).not.toBe(originalConsole.fatal);
    });

    it("should write to stdout with correct format", async () => {
      // WHEN
      await LogPatch.patchConsole();
      console.info("test message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        `${mockTimestamp}\t${mockRequestId}\tINFO\ttest message\n`,
      );
    });

    it("should handle message with parameters", async () => {
      // WHEN
      await LogPatch.patchConsole();
      console.info("test %s %d", "param", 42);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        `${mockTimestamp}\t${mockRequestId}\tINFO\ttest param 42\n`,
      );
    });
  });

  describe("telemetry logging", () => {
    it("should write to telemetry fd when available", async () => {
      // GIVEN
      vi.mocked(utils.consumeTelemetryFd).mockReturnValue(123);

      // WHEN
      await LogPatch.patchConsole();
      console.info("test message");

      // THEN
      expect(fs.writeSync).toHaveBeenCalled();
      expect(process.stdout.write).not.toHaveBeenCalled();
    });
  });

  describe("log levels", () => {
    it("should respect minimum log level", async () => {
      // GIVEN
      vi.mocked(utils.determineLogLevel).mockReturnValue(LOG_LEVEL.ERROR);

      // WHEN
      await LogPatch.patchConsole();
      console.info("should not log");

      // THEN
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("should use correct log levels for each console method", async () => {
      // GIVEN
      vi.mocked(utils.determineLogLevel).mockReturnValue(LOG_LEVEL.TRACE);
      await LogPatch.patchConsole();

      // WHEN
      console.trace("trace message");
      console.debug("debug message");
      console.info("info message");
      console.warn("warn message");
      console.error("error message");
      console.fatal("fatal message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("\tTRACE\ttrace message\n"),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("\tDEBUG\tdebug message\n"),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("\tINFO\tinfo message\n"),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("\tWARN\twarn message\n"),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("\tERROR\terror message\n"),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("\tFATAL\tfatal message\n"),
      );
    });
  });

  describe("structuredConsole", () => {
    it("should log errors through current logger", async () => {
      // GIVEN
      await LogPatch.patchConsole();
      const error = new Error("test error");

      // WHEN
      structuredConsole.logError("Error occurred", error);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Error occurred"),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("test error"),
      );
    });

    it("should not throw if used before console is patched", () => {
      // WHEN/THEN
      expect(() =>
        structuredConsole.logError("Error occurred", new Error("test")),
      ).not.toThrow();
    });
  });

  describe("multi-concurrent mode", () => {
    beforeEach(() => {
      vi.spyOn(utils, "determineLogFormat").mockReturnValue(LOG_FORMAT.TEXT);
      vi.spyOn(utils, "isMultiConcurrentMode").mockReturnValue(true);
    });

    it("should use SocketLogger in multi-concurrent mode", async () => {
      // GIVEN
      vi.spyOn(socketUtils, "acquireSocketFd").mockResolvedValue(42);

      // WHEN
      await LogPatch.patchConsole();
      console.info("test message");

      // THEN
      expect(fs.writeSync).toHaveBeenCalledWith(42, expect.any(String));
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("should force JSON format in multi-concurrent mode", async () => {
      // WHEN
      await LogPatch.patchConsole();
      console.info("test message");

      // THEN
      expect(fs.writeSync).toHaveBeenCalledWith(
        expect.any(Number),
        expect.stringContaining('"level":"INFO"'),
      );
    });

    it("should fallback to stdout when socket returns fd 1", async () => {
      // GIVEN

      // WHEN
      await LogPatch.patchConsole();
      console.info("test message");

      // THEN
      expect(fs.writeSync).toHaveBeenCalledWith(1, expect.any(String));
    });
  });

  describe("JSON format logging", () => {
    beforeEach(() => {
      vi.mocked(utils.determineLogFormat).mockReturnValue(LOG_FORMAT.JSON);
      vi.mocked(utils.determineLogLevel).mockReturnValue(LOG_LEVEL.TRACE);
    });

    it("should log messages in JSON format", async () => {
      // GIVEN
      await LogPatch.patchConsole();

      // WHEN
      console.info("test message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"timestamp":"${mockTimestamp}"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"requestId":"${mockRequestId}"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"INFO"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"message":"test message"`),
      );
    });

    it("should format message parameters in JSON format", async () => {
      // GIVEN
      await LogPatch.patchConsole();

      // WHEN
      console.info("test %s %d", "param", 42);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"message":"test param 42"`),
      );
    });

    it("should handle error objects in JSON format", async () => {
      // GIVEN
      await LogPatch.patchConsole();
      const error = new Error("test error");

      // WHEN
      console.error("An error occurred", error);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"ERROR"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"message":"An error occurred`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"errorType":"Error"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"errorMessage":"test error"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"stackTrace":`),
      );
    });

    it("should handle complex objects in JSON format", async () => {
      // GIVEN
      await LogPatch.patchConsole();
      const complexObject = { key: "value", nested: { array: [1, 2, 3] } };

      // WHEN
      console.info(complexObject);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(
          `"message":{"key":"value","nested":{"array":[1,2,3]}}`,
        ),
      );
    });

    it("should handle circular references", async () => {
      // GIVEN
      await LogPatch.patchConsole();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circular: any = { key: "value" };
      circular.self = circular;

      // WHEN
      console.info(circular);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(
          `"message":"<ref *1> { key: 'value', self: [Circular *1] }"`,
        ),
      );
    });

    it("should log all levels in JSON format", async () => {
      // GIVEN
      await LogPatch.patchConsole();

      // WHEN
      console.trace("trace message");
      console.debug("debug message");
      console.info("info message");
      console.warn("warn message");
      console.error("error message");
      console.fatal("fatal message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"TRACE"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"DEBUG"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"INFO"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"WARN"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"ERROR"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"FATAL"`),
      );
      expect(process.stdout.write).toHaveBeenCalledTimes(6);
    });

    it("should handle structuredConsole with JSON format", async () => {
      // GIVEN
      await LogPatch.patchConsole();
      const error = new Error("test error");

      // WHEN
      structuredConsole.logError("Error occurred", error);

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"level":"ERROR"`),
      );

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"errorType":"Error"`),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(`"errorMessage":"test error"`),
      );
    });
  });
});
