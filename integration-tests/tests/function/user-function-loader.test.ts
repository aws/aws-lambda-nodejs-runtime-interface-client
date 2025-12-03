import { describe, it, expect } from "vitest";
import path from "path";
import {
  HandlerNotFoundError,
  MalformedHandlerNameError,
  UserCodeSyntaxError,
} from "../../../src/utils";
import { UserFunctionLoader } from "../../../src/function";

const APP_ROOT = path.join(__dirname, "../../test-files/module-loader");

describe("UserFunctionLoader", () => {
  describe("load", () => {
    it("should load a simple handler", async () => {
      // GIVEN
      const handlerString = "echo.echo";

      // WHEN
      const { handler, metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        handlerString,
      );

      // THEN
      expect(handler).toBeInstanceOf(Function);
      // @ts-expect-error // no need for context and callback passing
      expect(handler("hello")).toBe("hello");
      expect(metadata).toEqual({
        highWaterMark: undefined,
        streaming: false,
        argsNum: 1,
      });
    });

    it("should load a async handler", async () => {
      // GIVEN
      const handlerString = "async.handlerAsync";

      // WHEN
      const { handler, metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        handlerString,
      );

      // THEN
      expect(handler).toBeInstanceOf(Function);
      // @ts-expect-error // no need for context and callback passing
      const response = await handler("hello");
      expect(response).toBe("async echo");
      expect(metadata).toEqual({
        highWaterMark: undefined,
        streaming: false,
        argsNum: 0,
      });
    });

    it("should load a nested handler", async () => {
      // GIVEN
      const handlerString = "deeply/nested/dir/index.handler";

      // WHEN
      const { handler, metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        handlerString,
      );

      // THEN
      expect(handler).toBeInstanceOf(Function);
      // @ts-expect-error // no need for context and callback passing
      expect(handler()).toBe("Hello from index.js");
      expect(metadata).toEqual({
        highWaterMark: undefined,
        streaming: false,
        argsNum: 0,
      });
    });

    it("should load a deeply nested CJS handler", async () => {
      // GIVEN
      const handlerString = "nestedHandler.nested.somethingComplex.handler";

      // WHEN
      const { handler, metadata } = await UserFunctionLoader.load(
        APP_ROOT,
        handlerString,
      );

      // THEN
      expect(handler).toBeInstanceOf(Function);
      // @ts-expect-error // no need for context and callback passing
      expect(await handler()).toBe("something interesting");
      expect(metadata).toEqual({
        highWaterMark: undefined,
        streaming: false,
        argsNum: 0,
      });
    });

    it("should handle deeply nested handler paths", async () => {
      // GIVEN
      const handlerString = "deeply/nested/dir/index.nested.deeper.handler";

      // WHEN
      const { handler } = await UserFunctionLoader.load(
        APP_ROOT,
        handlerString,
      );

      // THEN
      expect(handler).toBeInstanceOf(Function);
      // @ts-expect-error // no need for context and callback passing
      expect(handler()).toBe("Hello from nested.deeper.handler");
    });

    it("should throw MalformedHandlerNameError for relative paths", async () => {
      // GIVEN
      const handlerString = "../outside/module.handler";

      // WHEN & THEN
      await expect(() =>
        UserFunctionLoader.load(APP_ROOT, handlerString),
      ).rejects.toThrow(MalformedHandlerNameError);
    });

    it("should throw HandlerNotFoundError for non-existent handler in valid module", async () => {
      // GIVEN
      const handlerString = "echo.nonexistentHandler";

      // WHEN & THEN
      await expect(() =>
        UserFunctionLoader.load(APP_ROOT, handlerString),
      ).rejects.toThrow(HandlerNotFoundError);
    });

    it("should throw HandlerNotFoundError when handler is not a function", async () => {
      // GIVEN
      const handlerString = "deeply/nested/dir/index.notAFunction";

      // WHEN & THEN
      await expect(() =>
        UserFunctionLoader.load(APP_ROOT, handlerString),
      ).rejects.toThrow(HandlerNotFoundError);
    });

    it("should load handler from module with precedence rules", async () => {
      // GIVEN
      const handlerString = "precedence-extensionless/cjs-module.greet";

      // WHEN
      const { handler } = await UserFunctionLoader.load(
        APP_ROOT,
        handlerString,
      );

      // THEN
      expect(handler).toBeInstanceOf(Function);
      // @ts-expect-error // no need for context and callback passing
      expect(handler()).toBe("Hello from extensionless!");
    });

    it("should propagate syntax errors from module", async () => {
      // GIVEN
      const handlerString = "python.hello";

      // WHEN & THEN
      await expect(
        UserFunctionLoader.load(APP_ROOT, handlerString),
      ).rejects.toThrow(UserCodeSyntaxError);
    });

    it("should propagate runtime errors from module", async () => {
      // GIVEN
      const handlerString = "error.handler";

      // WHEN & THEN
      await expect(() =>
        UserFunctionLoader.load(APP_ROOT, handlerString),
      ).rejects.toThrow("Random Foo Error");
    });
  });
});
