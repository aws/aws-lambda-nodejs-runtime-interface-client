import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./verbose-log.js";

describe("verbose-log", () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    process.env = { ...originalEnv };
    console.log = vi.fn();
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.AWS_LAMBDA_RUNTIME_VERBOSE;
    process.env = originalEnv;
    console.log = originalConsoleLog;
  });

  describe("verbosity levels", () => {
    it("should not log when verbosity is 0", () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "0";
      const log = logger("TEST");

      // WHEN
      log.verbose("test message");
      log.vverbose("test message");
      log.vvverbose("test message");

      // THEN
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should log verbose when verbosity is 1", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "1";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");

      // WHEN
      log.verbose("test message");
      log.vverbose("test message");
      log.vvverbose("test message");

      // THEN
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "RUNTIME",
        "TEST",
        "test message",
      );
    });

    it("should log verbose and vverbose when verbosity is 2", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "2";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");

      // WHEN
      log.verbose("test message");
      log.vverbose("test message");
      log.vvverbose("test message");

      // THEN
      expect(console.log).toHaveBeenCalledTimes(2);
    });

    it("should log all levels when verbosity is 3", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "3";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");

      // WHEN
      log.verbose("test message");
      log.vverbose("test message");
      log.vvverbose("test message");

      // THEN
      expect(console.log).toHaveBeenCalledTimes(3);
    });
  });

  describe("lazy evaluation", () => {
    it("should not evaluate function arguments when verbosity is too low", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "0";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");
      const expensiveOperation = vi.fn(() => "expensive result");

      // WHEN
      log.verbose(expensiveOperation);

      // THEN
      expect(expensiveOperation).not.toHaveBeenCalled();
    });

    it("should evaluate function arguments when verbosity is sufficient", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "1";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");
      const expensiveOperation = vi.fn(() => "expensive result");

      // WHEN
      log.verbose(expensiveOperation);

      // THEN
      expect(expensiveOperation).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "RUNTIME",
        "TEST",
        "expensive result",
      );
    });
  });

  describe("error handling", () => {
    it("should handle invalid verbosity values", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "invalid";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");

      // WHEN/THEN - should not throw
      expect(() => log.verbose("test")).not.toThrow();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should clamp negative verbosity to 0", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "-1";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");

      // WHEN
      log.verbose("test message");

      // THEN
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should clamp verbosity above 3 to 3", async () => {
      // GIVEN
      process.env.AWS_LAMBDA_RUNTIME_VERBOSE = "4";
      const { logger } = await import("./verbose-log.js");
      const log = logger("TEST");

      // WHEN
      log.verbose("test");
      log.vverbose("test");
      log.vvverbose("test");

      // THEN
      expect(console.log).toHaveBeenCalledTimes(3);
    });
  });
});
