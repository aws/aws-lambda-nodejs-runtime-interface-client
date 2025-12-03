import { describe, it, expect } from "vitest";
import { formatError, intoError, toFormatted } from "./error.js";
import { FORMAT } from "../logging/index.js";

describe.concurrent("formatError", () => {
  it("should format a standard Error correctly", () => {
    // GIVEN
    const err = new Error("Something went wrong");

    // WHEN
    const result = formatError(err);

    // THEN
    expect(result.errorType).toBe("Error");
    expect(result.errorMessage).toBe("Something went wrong");
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace[0]).toContain("Error: Something went wrong");
  });

  it("should replace ASCII DEL character (\x7F) with %7F in error name, message and stack", () => {
    // GIVEN
    const err = new Error("Bad\x7Fmessage");
    err.name = "Type\x7FError";
    err.stack = `Type\x7FError: Bad\x7Fmessage\n    at example.ts:1:1`;

    // WHEN
    const result = formatError(err);

    // THEN
    expect(result.errorType).toBe("Type%7FError");
    expect(result.errorMessage).toBe("Bad%7Fmessage");
    expect(result.trace).toEqual([
      "Type%7FError: Bad%7Fmessage",
      "    at example.ts:1:1",
    ]);
  });

  it("should handle non-Error string inputs gracefully", () => {
    // GIVEN
    const input: unknown = "A string error";

    // WHEN
    const result = formatError(input as Error);

    // THEN
    expect(result.errorType).toBe("string");
    expect(result.errorMessage).toBe("A string error");
    expect(result.trace).toEqual([]);
  });

  it("should handle null input", () => {
    // GIVEN
    const input: unknown = null;

    // WHEN
    const result = formatError(input as Error);

    // THEN
    expect(result.errorType).toBe("object");
    expect(result.errorMessage).toBe("null");
    expect(result.trace).toEqual([]);
  });
});

describe("intoError", () => {
  it("should return Error objects unchanged", () => {
    // GIVEN
    const original = new Error("test error");

    // WHEN
    const result = intoError(original);

    // THEN
    expect(result).toBe(original);
  });

  it("should convert non-Error objects to Error", () => {
    // GIVEN
    const testCases = [
      { input: "string error", expected: "string error" },
      { input: 42, expected: "42" },
      { input: true, expected: "true" },
      { input: { custom: "error" }, expected: "[object Object]" },
      { input: null, expected: "null" },
      { input: undefined, expected: "undefined" },
    ];

    // WHEN & THEN
    testCases.forEach(({ input, expected }) => {
      const result = intoError(input);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(expected);
    });
  });
});

describe("toFormatted", () => {
  it("should format Error objects with additional properties", () => {
    // GIVEN
    const error = new Error("test message");
    error.name = "TestError";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).code = "TEST_CODE";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).customProp = "custom value";

    // WHEN
    const result = toFormatted(error);

    // THEN
    expect(result).toBe(
      FORMAT.FIELD_DELIMITER +
        JSON.stringify({
          errorType: "TestError",
          errorMessage: "test message",
          code: "TEST_CODE",
          name: "TestError",
          customProp: "custom value",
          stack: error.stack?.split(FORMAT.LINE_DELIMITER),
        }),
    );
  });

  it("should handle errors without stack", () => {
    // GIVEN
    const error = new Error("test message");
    error.stack = undefined;

    // WHEN
    const result = toFormatted(error);

    // THEN
    expect(result).toBe(
      FORMAT.FIELD_DELIMITER +
        JSON.stringify({
          errorType: "Error",
          errorMessage: "test message",
          code: undefined,
        }),
    );
  });

  it("should handle stringify failures", () => {
    // GIVEN
    const error = new Error("test message");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circular: any = { error };
    circular.self = circular;
    error.cause = circular;

    // WHEN
    const result = toFormatted(error);

    // THEN
    expect(result).toBe(
      FORMAT.FIELD_DELIMITER +
        JSON.stringify({
          errorType: "Error",
          errorMessage: "test message",
          trace: error.stack?.split("\n"),
        }),
    );
  });

  it("should handle non-enumerable properties", () => {
    // GIVEN
    const error = new Error("test message");
    Object.defineProperty(error, "hidden", {
      enumerable: false,
      value: "hidden value",
    });

    // WHEN
    const result = toFormatted(error);

    // THEN
    const parsed = JSON.parse(result.slice(FORMAT.FIELD_DELIMITER.length));
    expect(parsed).not.toHaveProperty("hidden");
  });
});
