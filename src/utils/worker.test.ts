import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWorkerCount } from "./worker.js";

vi.mock("module", () => {
  const mockReadFileSync = vi.fn();
  const mockCpus = vi.fn();
  return {
    createRequire: () => (module: string) => {
      if (module === "node:fs") {
        return { readFileSync: mockReadFileSync };
      }
      if (module === "node:os") {
        return { cpus: mockCpus };
      }
      return vi.importActual(module);
    },
  };
});

const CUSTOMER_ENV_RESPONSE = 5;
const CPU_MAX_QUOTA = 200000;
const CPU_MAX_PERIOD = 100000;
const CPU_MAX_CALCULATED_CPUS = 2;
const CPU_MAX_EXPECTED_WORKERS = 8 * CPU_MAX_CALCULATED_CPUS;
const DEFAULT_CPU_COUNT = 1;
const DEFAULT_WORKER_COUNT = 8 * DEFAULT_CPU_COUNT;
const OS_DETECTED_CPUS = 4;

describe("worker utils", () => {
  const originalEnv = process.env;
  let mockReadFileSync: ReturnType<typeof vi.fn>;
  let mockCpus: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    // Get the mocked functions
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const fs = require("node:fs");
    const os = require("node:os");
    mockReadFileSync = fs.readFileSync;
    mockCpus = os.cpus;

    mockReadFileSync.mockImplementation(() => {
      throw new Error("File not found");
    });
    mockCpus.mockReturnValue(new Array(OS_DETECTED_CPUS));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe("getWorkerCount", () => {
    it("should return env var value when set", () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT =
        CUSTOMER_ENV_RESPONSE.toString();

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBe(CUSTOMER_ENV_RESPONSE);
    });

    it("should use cpu.max quota/period when available", async () => {
      // GIVEN
      delete process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT;
      mockReadFileSync.mockReturnValue(`${CPU_MAX_QUOTA} ${CPU_MAX_PERIOD}`);

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBe(CPU_MAX_EXPECTED_WORKERS);
      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/sys/fs/cgroup/cpu.max",
        "utf8",
      );
    });

    it("should fallback to default when cpu.max fails", async () => {
      // GIVEN
      delete process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT;
      mockReadFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBe(DEFAULT_WORKER_COUNT);
    });

    it("should handle cpu.max unlimited (max)", async () => {
      // GIVEN
      delete process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT;
      mockReadFileSync.mockReturnValue("max 100000");
      mockCpus.mockReturnValue(new Array(OS_DETECTED_CPUS));

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBe(8 * OS_DETECTED_CPUS);
    });

    it("should handle invalid cpu.max values", async () => {
      // GIVEN
      delete process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT;
      mockReadFileSync.mockReturnValue("0 100000");

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBe(DEFAULT_WORKER_COUNT);
    });

    it("should handle invalid env var by falling back to CPU detection", () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT = "invalid";

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBeNaN();
    });

    it("should handle zero value", () => {
      // GIVEN
      process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT = "0";

      // WHEN
      const result = getWorkerCount();

      // THEN
      expect(result).toBe(0);
    });
  });
});
