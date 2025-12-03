import type { Worker as workerType } from "worker_threads";
import { structuredConsole } from "../logging/index.js";
import { logger } from "../logging/verbose-log.js";
import { getWorkerCount } from "../utils/index.js";
import { cjsRequire } from "../utils/cjs-require.js";

const { Worker } = cjsRequire("worker_threads");

const verboseLog = logger("WorkerManager");

export class WorkerManager {
  public async start(): Promise<void> {
    const workerCount = getWorkerCount();

    verboseLog.verbose(`Starting ${workerCount} worker threads`);

    const workerPromises: Promise<void>[] = [];

    for (let i = 0; i < workerCount; i++) {
      const workerId = i;
      const worker = new Worker(new URL(import.meta.url), {
        env: process.env,
        execArgv: this.getFilteredExecArgv(),
      });

      workerPromises.push(this.waitForWorker(worker, workerId));
    }

    await Promise.allSettled(workerPromises);
    verboseLog.verbose("All workers have exited");
  }

  private waitForWorker(worker: workerType, workerId: number): Promise<void> {
    return new Promise<void>((resolve) => {
      worker.on("error", (error) => {
        structuredConsole.logError(`Worker ${workerId} error:`, error);
        resolve();
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          const error = new Error(
            `Worker ${workerId} exited with code ${code}`,
          );
          structuredConsole.logError(`Worker ${workerId} exit:`, error);
        }
        resolve();
      });
    });
  }

  private getFilteredExecArgv(): string[] {
    const invalidWorkerFlags = [
      "--expose-gc",
      "--max-semi-space-size",
      "--max-old-space-size",
    ];

    return process.execArgv.filter((arg) => {
      return !invalidWorkerFlags.some((flag) => arg.startsWith(flag));
    });
  }
}
