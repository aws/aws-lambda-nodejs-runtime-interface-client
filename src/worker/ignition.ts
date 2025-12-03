import { WorkerManager } from "./worker-manager.js";
import { createRuntime } from "../utils/runtime-setup.js";
import { isMultiConcurrentMode } from "../utils/env.js";
import { logger } from "../logging/verbose-log.js";
import { cjsRequire } from "../utils/cjs-require.js";

const { isMainThread } = cjsRequire("node:worker_threads");

const verboseLog = logger("Ignition");

export async function ignition(): Promise<void> {
  if (isMultiConcurrentMode() && isMainThread) {
    verboseLog.verbose("Running in MultiConcurrent Mode");
    const manager = new WorkerManager();
    await manager.start();
  } else {
    verboseLog.verbose("Running worker thread");
    const runtime = await createRuntime();
    await runtime.start();
  }
}
