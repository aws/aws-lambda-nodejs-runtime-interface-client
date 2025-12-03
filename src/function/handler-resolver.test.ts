import { describe, it, expect } from "vitest";
import { HandlerNotFoundError } from "../utils/index.js";
import { resolveHandler } from "./handler-resolver.js";

describe("handler-resolver", () => {
  describe("resolveHandler", () => {
    it("resolves top-level handler", () => {
      // GIVEN
      const module = {
        handler: () => "test",
      };

      // WHEN
      const result = resolveHandler(module, "handler", "module.handler");

      // THEN
      expect(result).toBe(module.handler);
    });

    it("resolves nested handler", () => {
      // GIVEN
      const module = {
        nested: {
          handler: () => "test",
        },
      };

      // WHEN
      const result = resolveHandler(
        module,
        "nested.handler",
        "module.nested.handler",
      );

      // THEN
      expect(result).toBe(module.nested.handler);
    });

    it("throws when handler is undefined", () => {
      // GIVEN
      const module = {};

      // WHEN/THEN
      expect(() => resolveHandler(module, "handler", "module.handler")).toThrow(
        HandlerNotFoundError,
      );
      expect(() => resolveHandler(module, "handler", "module.handler")).toThrow(
        "module.handler is undefined or not exported",
      );
    });

    it("throws when handler is not a function", () => {
      // GIVEN
      const module = {
        handler: "not a function",
      };

      // WHEN/THEN
      expect(() => resolveHandler(module, "handler", "module.handler")).toThrow(
        HandlerNotFoundError,
      );
      expect(() => resolveHandler(module, "handler", "module.handler")).toThrow(
        "module.handler is not a function",
      );
    });

    it("throws when nested path is invalid", () => {
      // GIVEN
      const module = {
        nested: {
          handler: () => "test",
        },
      };

      // WHEN/THEN
      expect(() =>
        resolveHandler(module, "wrong.path", "module.wrong.path"),
      ).toThrow(HandlerNotFoundError);
    });
  });
});
