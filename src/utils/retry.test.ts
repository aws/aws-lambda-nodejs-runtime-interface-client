import { describe, it, expect } from "vitest";
import {
  calculateBackoffDelay,
  RetryOptions,
  DEFAULT_RETRY_OPTIONS,
} from "./retry.js";

describe("retry utilities", () => {
  describe("calculateBackoffDelay", () => {
    it("should calculate exponential backoff", () => {
      // GIVEN
      const options: RetryOptions = {
        initialDelayMs: 100,
        maxDelayMs: 10000,
        maxRetries: 5,
      };

      // WHEN & THEN
      expect(calculateBackoffDelay(0, options)).toBe(100);
      expect(calculateBackoffDelay(1, options)).toBe(200);
      expect(calculateBackoffDelay(2, options)).toBe(400);
      expect(calculateBackoffDelay(3, options)).toBe(800);
      expect(calculateBackoffDelay(4, options)).toBe(1600);
    });

    it("should respect max delay", () => {
      // GIVEN
      const options: RetryOptions = {
        initialDelayMs: 500,
        maxDelayMs: 1000,
        maxRetries: 5,
      };

      // WHEN & THEN
      expect(calculateBackoffDelay(0, options)).toBe(500);
      expect(calculateBackoffDelay(1, options)).toBe(1000); // 1000, not 1000
      expect(calculateBackoffDelay(2, options)).toBe(1000); // 1000, not 2000
    });

    it("should use default options when none provided", () => {
      // WHEN & THEN
      expect(calculateBackoffDelay(0)).toBe(
        DEFAULT_RETRY_OPTIONS.initialDelayMs,
      );
      expect(calculateBackoffDelay(1)).toBe(
        DEFAULT_RETRY_OPTIONS.initialDelayMs * 2,
      );
    });
  });
});
