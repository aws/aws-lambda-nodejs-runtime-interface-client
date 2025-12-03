import { describe, test, expect } from "vitest";
import { parseHostPort, isValidPort } from "./network.js";

describe.concurrent("parseHostPort", () => {
  test("parses valid hostname:port combinations", () => {
    // GIVEN
    const testCases = [
      {
        input: "localhost:3000",
        expected: { hostname: "localhost", port: 3000 },
      },
      {
        input: "example.com:8080",
        expected: { hostname: "example.com", port: 8080 },
      },
      {
        input: "127.0.0.1:80",
        expected: { hostname: "127.0.0.1", port: 80 },
      },
      {
        input: "sub.domain.com:443",
        expected: { hostname: "sub.domain.com", port: 443 },
      },
    ];

    testCases.forEach(({ input, expected }) => {
      // WHEN
      const result = parseHostPort(input);
      // THEN
      expect(result).toEqual(expected);
    });
  });

  test("throws error for missing port", () => {
    // GIVEN
    const invalidInputs = [
      "localhost",
      "example.com",
      "hostname:",
      "domain.com:",
    ];

    invalidInputs.forEach((input) => {
      // WHEN & THEN
      expect(() => parseHostPort(input)).toThrow(
        `Invalid hostnamePort: ${input}`,
      );
    });
  });

  test("throws error for invalid port numbers", () => {
    // GIVEN
    const invalidInputs = [
      "localhost:abc",
      "example.com:port",
      "hostname:65536",
      "domain.com:-80",
      "test.com:1.5",
    ];

    invalidInputs.forEach((input) => {
      // WHEN & THEN
      expect(() => parseHostPort(input)).toThrow(
        `Invalid hostnamePort: ${input}`,
      );
    });
  });

  test("throws error for empty input", () => {
    // GIVEN
    const invalidInputs = ["", ":80", ":"];

    invalidInputs.forEach((input) => {
      // WHEN & THEN
      expect(() => parseHostPort(input)).toThrow(
        `Invalid hostnamePort: ${input}`,
      );
    });
  });

  test("throws error for multiple colons", () => {
    // GIVEN
    const invalidInputs = [
      "localhost:8080:8081",
      "http://example.com:8080",
      "hostname:port:80",
    ];

    invalidInputs.forEach((input) => {
      // WHEN & THEN
      expect(() => parseHostPort(input)).toThrow(
        `Invalid hostnamePort: ${input}`,
      );
    });
  });
});

describe.concurrent("isValidPort", () => {
  test("returns true for valid ports", () => {
    // GIVEN
    const validPorts = ["0", "80", "443", "3000", "65535"];

    validPorts.forEach((portString) => {
      // WHEN
      const result = isValidPort(portString);
      // THEN
      expect(result).toBe(true);
    });
  });

  test("returns false for non-integer or out-of-range ports", () => {
    // GIVEN
    const invalidPorts = [
      "65536",
      "-1",
      "1.5",
      "abc",
      "",
      " ",
      "0001",
      "08",
      "Infinity",
      "NaN",
    ];

    invalidPorts.forEach((portString) => {
      // WHEN
      const result = isValidPort(portString);
      // THEN
      expect(result).toBe(false);
    });
  });
});
