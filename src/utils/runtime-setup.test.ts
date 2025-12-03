import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRuntime } from "./runtime-setup.js";
import { RAPIDClient } from "../client/index.js";
import { Runtime } from "../runtime/index.js";
import {
  UserFunctionLoader,
  errorOnDeprecatedCallback,
} from "../function/index.js";
import { CallbackHandlerDeprecatedError } from "./errors.js";
import { setupGlobals } from "./globals.js";
import { structuredConsole } from "../logging/index.js";
import http from "http";

vi.mock("../client/index.js");
vi.mock("../runtime/index.js");
vi.mock("../function/index.js");
vi.mock("./before-exit-listener.js");
vi.mock("./globals.js");

describe("runtime-setup", () => {
  const originalEnv = process.env;
  const mockHandler = vi.fn();
  const mockRapidClient = {
    postInitError: vi.fn(),
  } as unknown as RAPIDClient;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };

    // Setup required environment variables
    process.env.AWS_LAMBDA_RUNTIME_API = "test-api:8080";
    process.env.LAMBDA_TASK_ROOT = "/test/path";
    process.env._HANDLER = "test.handler";

    // Setup mocks
    vi.mocked(RAPIDClient.create).mockResolvedValue(mockRapidClient);
    vi.mocked(UserFunctionLoader.load).mockResolvedValue({
      handler: mockHandler,
      metadata: {},
    });
    vi.mocked(Runtime.create).mockReturnValue({} as Runtime);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("environment validation", () => {
    it("should throw if AWS_LAMBDA_RUNTIME_API is not set", async () => {
      // GIVEN
      delete process.env.AWS_LAMBDA_RUNTIME_API;

      // WHEN & THEN
      await expect(createRuntime()).rejects.toThrow(
        "AWS_LAMBDA_RUNTIME_API environment variable is not set",
      );
    });

    it("should throw if _HANDLER is not set", async () => {
      // GIVEN
      delete process.env._HANDLER;

      // WHEN & THEN
      await expect(createRuntime()).rejects.toThrow(
        "_HANDLER environment variable is not set",
      );
    });

    it("should throw if LAMBDA_TASK_ROOT is not set", async () => {
      // GIVEN
      delete process.env.LAMBDA_TASK_ROOT;

      // WHEN & THEN
      await expect(createRuntime()).rejects.toThrow(
        "LAMBDA_TASK_ROOT environment variable is not set",
      );
    });
  });

  describe("initialization", () => {
    it("should setup globals", async () => {
      // WHEN
      await createRuntime();

      // THEN
      expect(setupGlobals).toHaveBeenCalled();
    });

    it("should load user function with correct parameters", async () => {
      // WHEN
      await createRuntime();

      // THEN
      expect(UserFunctionLoader.load).toHaveBeenCalledWith(
        "/test/path",
        "test.handler",
      );
    });

    it("should create RAPID client with provided options", async () => {
      // GIVEN
      const mockOptions = {
        httpModule: http,
      };

      // WHEN
      await createRuntime(mockOptions);

      // THEN
      expect(RAPIDClient.create).toHaveBeenCalledWith(
        "test-api:8080",
        mockOptions,
        false,
      );
    });
  });

  describe("runtime creation", () => {
    it("should create runtime with correct configuration", async () => {
      // WHEN
      await createRuntime();

      // THEN
      expect(Runtime.create).toHaveBeenCalledWith({
        rapidClient: mockRapidClient,
        handler: mockHandler,
        handlerMetadata: {},
        isMultiConcurrent: false,
      });
    });
  });

  describe("console patching", () => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    beforeEach(() => {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      vi.resetAllMocks();
    });

    it("should patch console methods during runtime creation", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_API = "test-api:8080";
      process.env._HANDLER = "index.handler";
      process.env.LAMBDA_TASK_ROOT = "/test/path";

      // WHEN
      await createRuntime();
      console.log("test message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("test message"),
      );
      expect(console.log).not.toBe(originalConsoleLog);
    });

    it("should respect log format from environment", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_API = "test-api:8080";
      process.env._HANDLER = "index.handler";
      process.env.LAMBDA_TASK_ROOT = "/test/path";
      process.env.AWS_LAMBDA_LOG_FORMAT = "JSON";

      // WHEN
      await createRuntime();
      console.log("test message");

      // THEN
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"test message"'),
      );
    });

    it("should respect log level from environment", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_API = "test-api:8080";
      process.env._HANDLER = "index.handler";
      process.env.LAMBDA_TASK_ROOT = "/test/path";
      process.env.AWS_LAMBDA_LOG_LEVEL = "ERROR";

      // WHEN
      await createRuntime();
      console.info("should not log");

      // THEN
      expect(process.stdout.write).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vi.spyOn(structuredConsole, "logError").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("should handle UserFunctionLoader.load errors", async () => {
      // GIVEN
      const testError = new Error("Failed to load user function");
      vi.mocked(UserFunctionLoader.load).mockRejectedValue(testError);

      // WHEN & THEN
      await expect(createRuntime()).rejects.toThrow(
        "Failed to load user function",
      );

      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Init Error",
        testError,
      );

      expect(mockRapidClient.postInitError).toHaveBeenCalledWith(testError);
    });

    it("should handle callback deprecation errors", async () => {
      // GIVEN
      const callbackError = new CallbackHandlerDeprecatedError(
        "ERROR: AWS Lambda does not support callback-based function handlers when using Node.js 22 with Managed Instances",
      );
      vi.mocked(UserFunctionLoader.load).mockResolvedValue({
        handler: mockHandler,
        metadata: {
          argsNum: 3,
          streaming: false,
        },
      });
      vi.mocked(errorOnDeprecatedCallback).mockImplementation(() => {
        throw callbackError;
      });

      // WHEN & THEN
      await expect(createRuntime()).rejects.toThrow(
        "ERROR: AWS Lambda does not support callback-based function handlers when using Node.js 22 with Managed Instances",
      );

      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Init Error",
        callbackError,
      );

      expect(mockRapidClient.postInitError).toHaveBeenCalledWith(callbackError);
    });

    it("should handle Runtime.create errors", async () => {
      // GIVEN
      const testError = new Error("Failed to create runtime");
      vi.mocked(Runtime.create).mockImplementation(() => {
        throw testError;
      });

      // WHEN & THEN
      await expect(createRuntime()).rejects.toThrow("Failed to create runtime");

      // Verify error was logged
      expect(structuredConsole.logError).toHaveBeenCalledWith(
        "Init Error",
        testError,
      );

      expect(mockRapidClient.postInitError).toHaveBeenCalledWith(testError);
    });
  });
});
