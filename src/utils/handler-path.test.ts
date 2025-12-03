import { describe, it, expect } from "vitest";
import { parseHandlerString } from "./handler-path.js";
import { MalformedHandlerNameError } from "./errors.js";

describe("parseHandlerString", () => {
  it("parses handler with module path", () => {
    const result = parseHandlerString("./somepath/something/module.handler");
    expect(result).toEqual({
      moduleRoot: "./somepath/something",
      moduleName: "module",
      handlerName: "handler",
    });
  });

  it("parses handler without module path", () => {
    const result = parseHandlerString("module.handler");
    expect(result).toEqual({
      moduleRoot: "",
      moduleName: "module",
      handlerName: "handler",
    });
  });

  it("parses handler with nested function path", () => {
    const result = parseHandlerString("./path/module.nested.handler");
    expect(result).toEqual({
      moduleRoot: "./path",
      moduleName: "module",
      handlerName: "nested.handler",
    });
  });

  it("parses handler with absolute path", () => {
    const result = parseHandlerString("/var/task/module.handler");
    expect(result).toEqual({
      moduleRoot: "/var/task",
      moduleName: "module",
      handlerName: "handler",
    });
  });

  it("removes trailing slash from moduleRoot", () => {
    const result = parseHandlerString("./path/to/handler/module.function");
    expect(result).toEqual({
      moduleRoot: "./path/to/handler",
      moduleName: "module",
      handlerName: "function",
    });
  });

  it("throws on invalid handler format", () => {
    const invalidHandlers = [
      "",
      "/path.with.dots/handler",
      "module",
      "./path/module",
      "/var/task/handler",
    ];

    invalidHandlers.forEach((handler) => {
      expect(() => parseHandlerString(handler)).toThrow(
        MalformedHandlerNameError,
      );
    });
  });
});
