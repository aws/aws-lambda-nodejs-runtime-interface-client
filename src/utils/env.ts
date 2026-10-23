import { HEADERS } from "../context/index.js";
import { InvokeHeaders } from "../context/types.js";
import { DEFAULT_POLLING_COUNT } from "../context/constants.js";
import {
  LogFormat,
  LOG_FORMAT,
  LogLevel,
  LOG_LEVEL,
} from "../logging/index.js";

export function shouldUseAlternativeClient(): boolean {
  return process.env["AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1"] === "true";
}

export function determineLogFormat(): LogFormat {
  return process.env["AWS_LAMBDA_LOG_FORMAT"]?.toUpperCase() === LOG_FORMAT.JSON
    ? LOG_FORMAT.JSON
    : LOG_FORMAT.TEXT;
}

export function determineLogLevel(): LogLevel {
  const envLevel = process.env["AWS_LAMBDA_LOG_LEVEL"]?.toUpperCase();
  return envLevel && envLevel in LOG_LEVEL
    ? LOG_LEVEL[envLevel as keyof typeof LOG_LEVEL]
    : LOG_LEVEL.TRACE;
}

export function consumeTelemetryFd(): number | undefined {
  const raw = process.env["_LAMBDA_TELEMETRY_LOG_FD"];
  delete process.env["_LAMBDA_TELEMETRY_LOG_FD"];
  const fd = Number(raw);
  return Number.isInteger(fd) && fd >= 0 ? fd : undefined;
}

export function isMultiConcurrentMode(): boolean {
  return process.env["AWS_LAMBDA_MAX_CONCURRENCY"] !== undefined;
}

// Default polling count is 4. Override via AWS_LAMBDA_NODEJS_POLLING_COUNT.
// Capped at AWS_LAMBDA_MAX_CONCURRENCY to prevent excessive connections to RAPID.
export function getPollingCount(): number {
  const maxConcurrency = parseInt(
    process.env["AWS_LAMBDA_MAX_CONCURRENCY"] || "0",
    10,
  );
  const envValue = process.env["AWS_LAMBDA_NODEJS_POLLING_COUNT"];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!parsed || parsed <= 0) {
      console.warn(
        `Invalid AWS_LAMBDA_NODEJS_POLLING_COUNT="${envValue}", using default ${DEFAULT_POLLING_COUNT}`,
      );
      return DEFAULT_POLLING_COUNT;
    }
    if (maxConcurrency > 0 && parsed > maxConcurrency) {
      console.warn(
        `AWS_LAMBDA_NODEJS_POLLING_COUNT=${parsed} exceeds MC=${maxConcurrency}, capping`,
      );
      return maxConcurrency;
    }
    return parsed;
  }
  return DEFAULT_POLLING_COUNT;
}

// Override via AWS_LAMBDA_NODEJS_WORKER_COUNT.
// Capped at AWS_LAMBDA_MAX_CONCURRENCY to prevent spawning more workers than MC.
export function getWorkerCountFromEnv(): number | undefined {
  const envValue = process.env["AWS_LAMBDA_NODEJS_WORKER_COUNT"];
  if (!envValue) return undefined;

  const parsed = parseInt(envValue, 10);
  if (!parsed || parsed <= 0) {
    console.warn(
      `Invalid AWS_LAMBDA_NODEJS_WORKER_COUNT="${envValue}", ignoring`,
    );
    return undefined;
  }

  const maxConcurrency = parseInt(
    process.env["AWS_LAMBDA_MAX_CONCURRENCY"] || "0",
    10,
  );
  if (maxConcurrency > 0 && parsed > maxConcurrency) {
    console.warn(
      `AWS_LAMBDA_NODEJS_WORKER_COUNT=${parsed} exceeds MC=${maxConcurrency}, capping`,
    );
    return maxConcurrency;
  }
  return parsed;
}

export function moveXRayHeaderToEnv(headers: InvokeHeaders) {
  if (!isMultiConcurrentMode()) {
    if (headers[HEADERS.X_RAY_TRACE_ID]) {
      process.env["_X_AMZN_TRACE_ID"] = headers[HEADERS.X_RAY_TRACE_ID];
    } else {
      delete process.env["_X_AMZN_TRACE_ID"];
    }
  }
}
