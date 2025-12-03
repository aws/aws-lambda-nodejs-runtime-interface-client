import { HEADERS } from "../context/index.js";
import { InvokeHeaders } from "../context/types.js";
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

export function moveXRayHeaderToEnv(headers: InvokeHeaders) {
  if (!isMultiConcurrentMode()) {
    if (headers[HEADERS.X_RAY_TRACE_ID]) {
      process.env["_X_AMZN_TRACE_ID"] = headers[HEADERS.X_RAY_TRACE_ID];
    } else {
      delete process.env["_X_AMZN_TRACE_ID"];
    }
  }
}
