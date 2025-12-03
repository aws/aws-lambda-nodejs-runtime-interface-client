import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorkerManager } from "./worker-manager.js";

vi.mock("module", () => {
  const mockWorker = vi.fn();
  return {
    createRequire: () => (module: string) => {
      if (module === "worker_threads") {
        return { Worker: mockWorker };
      }
      return vi.importActual(module);
    },
  };
});

// Mock worker utility
vi.mock("../utils/worker.js", () => ({
  getWorkerCount: vi.fn(),
}));

describe("WorkerManager", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorker: any;
  let workerManager: WorkerManager;
  let Worker: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Get the mocked Worker function
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const workerThreads = require("worker_threads");
    Worker = workerThreads.Worker;

    // Create mock worker instance
    mockWorker = {
      on: vi.fn(),
      terminate: vi.fn(),
    };

    // Mock Worker constructor
    Worker.mockImplementation(() => mockWorker);

    // Mock getWorkerCount
    const { getWorkerCount } = await import("../utils/worker.js");
    vi.mocked(getWorkerCount).mockReturnValue(1); // Default to 1 worker

    workerManager = new WorkerManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("start", () => {
    it("should create workers based on getWorkerCount", async () => {
      // GIVEN
      const { getWorkerCount } = await import("../utils/worker.js");
      vi.mocked(getWorkerCount).mockReturnValue(3);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      mockWorker.on.mockImplementation((event: string, callback: Function) => {
        if (event === "exit") {
          setTimeout(() => callback(0), 0);
        }
      });

      // WHEN
      await workerManager.start();

      // THEN
      expect(Worker).toHaveBeenCalledTimes(3);
      expect(getWorkerCount).toHaveBeenCalled();
    });

    it("should filter invalid execArgv flags", async () => {
      // GIVEN
      const originalExecArgv = process.execArgv;
      process.execArgv = [
        "--expose-gc",
        "--max-old-space-size=1024",
        "--some-valid-flag",
      ];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      mockWorker.on.mockImplementation((event: string, callback: Function) => {
        if (event === "exit") {
          setTimeout(() => callback(0), 0);
        }
      });

      // WHEN
      await workerManager.start();

      // THEN
      expect(Worker).toHaveBeenCalledWith(expect.any(URL), {
        env: process.env,
        execArgv: ["--some-valid-flag"],
      });

      process.execArgv = originalExecArgv;
    });

    it("should handle worker errors gracefully", async () => {
      // GIVEN
      const testError = new Error("Worker failed");

      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      mockWorker.on.mockImplementation((event: string, callback: Function) => {
        if (event === "error") {
          setTimeout(() => callback(testError), 0);
        }
      });

      // WHEN
      await workerManager.start();

      // THEN - Should not throw, just complete
      expect(Worker).toHaveBeenCalledTimes(1);
    });

    it("should handle worker exit with non-zero code", async () => {
      // GIVEN
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      mockWorker.on.mockImplementation((event: string, callback: Function) => {
        if (event === "exit") {
          setTimeout(() => callback(1), 0);
        }
      });

      // WHEN
      await workerManager.start();

      // THEN - Should not throw, just complete
      expect(Worker).toHaveBeenCalledTimes(1);
    });
  });
});
