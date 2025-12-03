export const LOG_FORMAT = {
  JSON: "JSON",
  TEXT: "TEXT",
} as const;

export type LogFormat = (typeof LOG_FORMAT)[keyof typeof LOG_FORMAT];

export const LOG_LEVEL = {
  TRACE: { name: "TRACE", priority: 1, tlvMask: 0b00100 },
  DEBUG: { name: "DEBUG", priority: 2, tlvMask: 0b01000 },
  INFO: { name: "INFO", priority: 3, tlvMask: 0b01100 },
  WARN: { name: "WARN", priority: 4, tlvMask: 0b10000 },
  ERROR: { name: "ERROR", priority: 5, tlvMask: 0b10100 },
  FATAL: { name: "FATAL", priority: 6, tlvMask: 0b11000 },
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

export const TELEMETRY = {
  FRAME_HEADER_SIZE: 16, // 4 + 4 + 8 bytes
  TYPE_OFFSET: 0,
  LENGTH_OFFSET: 4,
  TIMESTAMP_OFFSET: 8,
  FRAME_TYPE_TEXT: 0xa55a0003,
  FRAME_TYPE_JSON: 0xa55a0002,
} as const;

export type TelemetryFrameType =
  | typeof TELEMETRY.FRAME_TYPE_TEXT
  | typeof TELEMETRY.FRAME_TYPE_JSON;

export const FORMAT = {
  FIELD_DELIMITER: "\t",
  LINE_DELIMITER: "\n",
  CARRIAGE_RETURN: "\r",
} as const;

export const JSON_LOG_FIELDS = {
  TIMESTAMP: "timestamp",
  LEVEL: "level",
  REQUEST_ID: "requestId",
  TENANT_ID: "tenantId",
  MESSAGE: "message",
  ERROR_TYPE: "errorType",
  ERROR_MESSAGE: "errorMessage",
  STACK_TRACE: "stackTrace",
} as const;
