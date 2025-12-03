import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("module", () => {
  const mockWorkerThreads = { isMainThread: true };
  return {
    createRequire: () => (module: string) => {
      if (module === "node:worker_threads") {
        return mockWorkerThreads;
      }
      return vi.importActual(module);
    },
  };
});

vi.mock("./worker-manager.js", () => ({
  WorkerManager: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../utils/runtime-setup.js", () => ({
  createRuntime: vi.fn().mockResolvedValue({
    start: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../utils/env.js", () => ({
  isMultiConcurrentMode: vi.fn(),
}));

vi.mock("../logging/verbose-log.js", () => ({
  logger: vi.fn(() => ({ verbose: vi.fn() })),
}));

describe("ignition", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset isMainThread to default
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const workerThreads = require("node:worker_threads");
    workerThreads.isMainThread = true;
  });

  it("should start WorkerManager when multi-concurrent and main thread", async () => {
    // GIVEN
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const workerThreads = require("node:worker_threads");
    const { isMultiConcurrentMode } = await import("../utils/env.js");
    const { WorkerManager } = await import("./worker-manager.js");

    vi.mocked(isMultiConcurrentMode).mockReturnValue(true);
    workerThreads.isMainThread = true;

    // WHEN
    const { ignition } = await import("./ignition.js");
    await ignition();

    // THEN
    expect(WorkerManager).toHaveBeenCalled();
  });

  it("should create runtime when not multi-concurrent", async () => {
    // GIVEN
    const { isMultiConcurrentMode } = await import("../utils/env.js");
    const { createRuntime } = await import("../utils/runtime-setup.js");

    vi.mocked(isMultiConcurrentMode).mockReturnValue(false);
    // isMainThread doesn't matter when not multi-concurrent

    // WHEN
    const { ignition } = await import("./ignition.js");
    await ignition();

    // THEN
    expect(createRuntime).toHaveBeenCalled();
  });

  it("should create runtime when multi-concurrent but not main thread", async () => {
    // GIVEN
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const workerThreads = require("node:worker_threads");
    const { isMultiConcurrentMode } = await import("../utils/env.js");
    const { createRuntime } = await import("../utils/runtime-setup.js");

    vi.mocked(isMultiConcurrentMode).mockReturnValue(true);
    workerThreads.isMainThread = false;

    // WHEN
    const { ignition } = await import("./ignition.js");
    await ignition();

    // THEN
    expect(createRuntime).toHaveBeenCalled();
  });
});
