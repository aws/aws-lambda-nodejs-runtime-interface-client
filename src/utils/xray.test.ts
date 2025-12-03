import { describe, it, expect } from "vitest";
import { formatXRayError } from "../utils/xray.js";

describe.concurrent("formatXRayError", () => {
  it("should handle a basic error with stack trace", () => {
    const error = new Error("Something went wrong");
    error.name = "CustomError";
    error.stack = `CustomError: Something went wrong
    at someFunction (/var/task/handler.js:10:15)`;

    const result = JSON.parse(formatXRayError(error));

    expect(result).toHaveProperty("working_directory");
    expect(typeof result.working_directory).toBe("string");
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0]).toEqual({
      type: "CustomError",
      message: "Something went wrong",
      stack: [
        {
          path: "/var/task/handler.js",
          line: 10,
          label: "someFunction",
        },
      ],
    });
    expect(result.paths).toEqual(["/var/task/handler.js"]);
  });

  it("should handle an error without stack trace", () => {
    const error = new Error("No stack here");
    error.name = "NoStackError";
    error.stack = undefined;

    const result = JSON.parse(formatXRayError(error));
    expect(result.exceptions[0].stack).toHaveLength(0);
    expect(result.paths).toEqual([]);
  });

  it("should handle multiple stack frames", () => {
    const error = new Error("Complex error");
    error.name = "ComplexError";
    error.stack = `ComplexError: Complex error
    at firstFunction (/var/task/one.js:1:100)
    at secondFunction (/var/task/two.js:2:200)
    at /var/task/three.js:3:300`;

    const result = JSON.parse(formatXRayError(error));
    expect(result.exceptions[0].stack).toEqual([
      { path: "/var/task/one.js", line: 1, label: "firstFunction" },
      { path: "/var/task/two.js", line: 2, label: "secondFunction" },
      { path: "/var/task/three.js", line: 3, label: "anonymous" },
    ]);
    expect(result.paths).toEqual([
      "/var/task/one.js",
      "/var/task/two.js",
      "/var/task/three.js",
    ]);
  });

  it("should encode invalid characters in name and message", () => {
    const error = new Error("\x7Fmessage");
    error.name = "Name\x7F";
    error.stack = `Name\x7F: \x7Fmessage
    at anon (/var/task/bad.js:99:1)`;

    const result = JSON.parse(formatXRayError(error));
    expect(result.exceptions[0].type).toBe("Name%7F");
    expect(result.exceptions[0].message).toBe("%7Fmessage");
  });

  it("should return empty string on circular reference", () => {
    class CircularError extends Error {
      public circular: CircularError;

      public constructor() {
        super("circular");
        this.name = "CircularError";
        this.circular = this;
      }

      public toString(): string {
        return "CircularError: circular";
      }
    }

    const error = new CircularError();
    error.stack = `CircularError: circular
    at circularFunction (/var/task/circle.js:1:1)`;

    // Manually inject the circular object into a field that gets stringified
    const originalStack = error.stack;
    type CircularStack = {
      toString: () => string;
      circular?: CircularStack;
    };

    const circularStack: CircularStack = {
      toString: () => originalStack,
    };
    circularStack.circular = circularStack;
    error.stack = circularStack as unknown as string;

    const result = formatXRayError(error);
    expect(result).toBe("");
  });
});
