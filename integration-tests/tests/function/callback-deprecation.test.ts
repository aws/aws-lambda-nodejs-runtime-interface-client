import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import {
  UserFunctionLoader,
  errorOnDeprecatedCallback,
} from "../../../src/function";
import { CallbackHandlerDeprecatedError } from "../../../src/utils";

const APP_ROOT = path.join(__dirname, "../../test-files/module-loader");

describe("callback-deprecation", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AWS_EXECUTION_ENV;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AWS_EXECUTION_ENV = originalEnv;
    } else {
      delete process.env.AWS_EXECUTION_ENV;
    }
  });

  describe("should throw error for callback handlers", () => {
    it("should throw Node.js 22 error for callback handler", async () => {
      // GIVEN
      process.env.AWS_EXECUTION_ENV = "AWS_Lambda_nodejs22.x";

      // WHEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "callback-handlers.callbackHandler",
      );

      // THEN
      expect(() => errorOnDeprecatedCallback(metadata)).toThrow(
        CallbackHandlerDeprecatedError,
      );
      expect(() => errorOnDeprecatedCallback(metadata)).toThrow(
        "ERROR: AWS Lambda does not support callback-based function handlers when using Node.js 22 with Managed Instances",
      );
    });

    it("should throw Node.js 24+ error for callback handler", async () => {
      // GIVEN
      process.env.AWS_EXECUTION_ENV = "AWS_Lambda_nodejs24.x";

      // WHEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "callback-handlers.callbackHandler",
      );

      // THEN
      expect(() => errorOnDeprecatedCallback(metadata)).toThrow(
        CallbackHandlerDeprecatedError,
      );
      expect(() => errorOnDeprecatedCallback(metadata)).toThrow(
        "ERROR: AWS Lambda has removed support for callback-based function handlers starting with Node.js 24",
      );
    });

    it("should throw error for handler with 4 args", async () => {
      // GIVEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "callback-handlers.callbackHandlerWithExtra",
      );

      // WHEN/THEN
      expect(() => errorOnDeprecatedCallback(metadata)).toThrow(
        CallbackHandlerDeprecatedError,
      );
    });
  });

  describe("should NOT throw error for valid handlers", () => {
    it("should not throw for single arg handler", async () => {
      // GIVEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "valid-handlers.singleArgHandler",
      );

      // WHEN/THEN
      expect(() => errorOnDeprecatedCallback(metadata)).not.toThrow();
    });

    it("should not throw for two arg handler", async () => {
      // GIVEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "valid-handlers.twoArgHandler",
      );

      // WHEN/THEN
      expect(() => errorOnDeprecatedCallback(metadata)).not.toThrow();
    });

    it("should not throw for no arg handler", async () => {
      // GIVEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "valid-handlers.noArgHandler",
      );

      // WHEN/THEN
      expect(() => errorOnDeprecatedCallback(metadata)).not.toThrow();
    });

    it("should not throw for streaming handler with 3 args", async () => {
      // GIVEN
      const { metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        "streaming-handlers.handler",
      );

      // WHEN/THEN
      expect(() => errorOnDeprecatedCallback(metadata)).not.toThrow();
    });
  });
});
