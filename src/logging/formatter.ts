import { FORMAT, JSON_LOG_FIELDS, LogLevel } from "./constants.js";
import { cjsRequire } from "../utils/cjs-require.js";

const { format } = cjsRequire("node:util");

export function formatTextMessage(
  timestamp: string,
  requestId: string,
  level: LogLevel,
  message: unknown,
  ...params: unknown[]
): string {
  return [timestamp, requestId, level.name, format(message, ...params)].join(
    FORMAT.FIELD_DELIMITER,
  );
}

export function formatJsonMessage(
  timestamp: string,
  requestId: string,
  tenantId: string,
  level: LogLevel,
  message: unknown,
  ...params: unknown[]
): string {
  const result: Record<string, unknown> = {
    [JSON_LOG_FIELDS.TIMESTAMP]: timestamp,
    [JSON_LOG_FIELDS.LEVEL]: level.name,
    [JSON_LOG_FIELDS.REQUEST_ID]: requestId,
  };
  // no need to append tenantId if it's null / undefined
  if (tenantId) {
    result[JSON_LOG_FIELDS.TENANT_ID] = tenantId;
  }

  if (params.length === 0) {
    result.message = message;
    try {
      return JSON.stringify(result, jsonErrorReplacer);
    } catch {
      result.message = format(result.message);
      return JSON.stringify(result);
    }
  }

  result.message = format(message, ...params);
  for (const param of params) {
    if (param instanceof Error) {
      result[JSON_LOG_FIELDS.ERROR_TYPE] =
        param?.constructor?.name ?? "UnknownError";
      result[JSON_LOG_FIELDS.ERROR_MESSAGE] = param.message;
      result[JSON_LOG_FIELDS.STACK_TRACE] =
        typeof param.stack === "string" ? param.stack.split("\n") : [];
      break;
    }
  }
  return JSON.stringify(result);
}

const jsonErrorReplacer = (_: unknown, value: unknown) => {
  if (value instanceof Error) {
    const serializedErr = Object.assign(
      {
        errorType: value?.constructor?.name ?? "UnknownError",
        errorMessage: value.message,
        stackTrace:
          typeof value.stack === "string"
            ? value.stack.split("\n")
            : value.stack,
      },
      value,
    );
    return serializedErr;
  }
  return value;
};
