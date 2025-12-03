import { WritableResponseStream } from "../stream/index.js";
import {
  OPTIONAL_INVOKE_HEADERS,
  REQUIRED_INVOKE_HEADERS,
} from "./constants.js";

export interface InvokeHeaders {
  // Required headers
  [REQUIRED_INVOKE_HEADERS.FUNCTION_ARN]: string;
  [REQUIRED_INVOKE_HEADERS.REQUEST_ID]: string;
  [REQUIRED_INVOKE_HEADERS.DEADLINE_MS]: string;

  // Optional headers
  [OPTIONAL_INVOKE_HEADERS.CLIENT_CONTEXT]?: string;
  [OPTIONAL_INVOKE_HEADERS.COGNITO_IDENTITY]?: string;
  [OPTIONAL_INVOKE_HEADERS.X_RAY_TRACE_ID]?: string;
  [OPTIONAL_INVOKE_HEADERS.TENANT_ID]?: string;
}

export interface InvokeContext {
  // Environment data
  readonly functionName: string;
  readonly functionVersion: string;
  readonly memoryLimitInMB: string;
  readonly logGroupName: string;
  readonly logStreamName: string;

  // Header data
  readonly clientContext?: Record<string, unknown>;
  readonly identity?: Record<string, unknown>;
  readonly invokedFunctionArn: string;
  readonly awsRequestId: string;
  readonly xRayTraceId?: string;
  readonly tenantId?: string;

  // Methods
  getRemainingTimeInMillis(): number;
}

export interface StreamOptions {
  highWaterMark?: number;
}

export interface ResponseStreamKit {
  responseStream: WritableResponseStream;
  rapidResponse: Promise<Buffer>;
}

export interface EventAndContext {
  event: unknown;
  context: InvokeContext;
}
