import { logger } from "../logging/verbose-log.js";
import { cjsRequire } from "./cjs-require.js";

const { readFileSync } = cjsRequire("node:fs");
const os = cjsRequire("node:os");

const verboseLog = logger("WorkerCount");
const DEFAULT_CPU_COUNT = 1;

function getAvailableCpus(): number {
  try {
    // https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html#cpu
    // cpu.max contains: "<max> <period>"
    const content = readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim();
    const [maxStr, periodStr] = content.split(/\s+/);

    const period = parseInt(periodStr, 10);

    if (maxStr === "max") {
      const detected = Math.max(1, os.cpus().length);
      verboseLog.vvverbose(
        `cpu.max reports unlimited quota ("max"), using detected cores: ${detected}`,
      );
      return detected;
    }

    const quota = parseInt(maxStr, 10);

    if (quota > 0 && period > 0) {
      const cpuCount = Math.ceil(quota / period);
      verboseLog.vvverbose(
        `Using cpu.max quota/period: ${quota}/${period} = ${cpuCount} CPUs`,
      );
      return cpuCount;
    }

    verboseLog.vvverbose(
      `cpu.max quota/period invalid: quota=${quota}, period=${period}`,
    );
  } catch {
    verboseLog.vvverbose("cpu.max file not accessible, falling back");
  }

  verboseLog.vvverbose(
    `Could not read taking minimum 1 vCPU: ${DEFAULT_CPU_COUNT} CPUs`,
  );
  return DEFAULT_CPU_COUNT;
}

export function getWorkerCount(): number {
  const envValue = process.env.AWS_LAMBDA_NODEJS_WORKER_COUNT;
  if (envValue) {
    const workerCount = parseInt(envValue, 10);
    verboseLog.vvverbose(
      `Using AWS_LAMBDA_NODEJS_WORKER_COUNT: ${envValue} = ${workerCount} workers`,
    );
    return workerCount;
  }

  const detectedCpus = getAvailableCpus();
  const calculatedWorkers = 8 * detectedCpus;
  verboseLog.vvverbose(
    `No env var set, using 8 * ${detectedCpus} = ${calculatedWorkers} workers`,
  );
  return calculatedWorkers;
}
