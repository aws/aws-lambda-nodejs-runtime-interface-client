import { describe, it, expect } from "vitest";
import { serializeToJSON } from "./serialize.js";

describe("serializeToJSON", () => {
  it("should serialize simple objects", () => {
    // GIVEN
    const input = { key: "value" };

    // WHEN
    const result = serializeToJSON(input);

    // THEN
    expect(result).toBe('{"key":"value"}');
  });

  it("should convert undefined to null", () => {
    // GIVEN
    const input = undefined;

    // WHEN
    const result = serializeToJSON(input);

    // THEN
    expect(result).toBe("null");
  });

  it("should serialize null correctly", () => {
    // GIVEN
    const input = null;

    // WHEN
    const result = serializeToJSON(input);

    // THEN
    expect(result).toBe("null");
  });

  it("should handle primitive types", () => {
    // THEN
    expect(serializeToJSON(123)).toBe("123");
    expect(serializeToJSON("string")).toBe('"string"');
    expect(serializeToJSON(true)).toBe("true");
  });

  it("should throw error for non-serializable objects", () => {
    // GIVEN
    type Circular = { self: Circular };
    const circular: Circular = {} as Circular;
    circular.self = circular;

    // THEN
    expect(() => serializeToJSON(circular)).toThrow(
      "Unable to stringify response body",
    );
  });

  it("should handle arrays", () => {
    // GIVEN
    const input = [1, "two", { three: 3 }];

    // WHEN
    const result = serializeToJSON(input);

    // THEN
    expect(result).toBe('[1,"two",{"three":3}]');
  });
});
