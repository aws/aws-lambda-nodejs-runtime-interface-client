import { moveXRayHeaderToEnv, PlatformError } from "../utils/index.js";
import {
  OPTIONAL_INVOKE_HEADERS,
  REQUIRED_ENV_VARS,
  REQUIRED_INVOKE_HEADERS,
} from "./constants.js";
import { InvokeContext, InvokeHeaders } from "./types.js";

export class ContextBuilder {
  public static build(headers: Record<string, string>): InvokeContext {
    this.validateEnvironment();
    const invokeHeaders = this.validateAndNormalizeHeaders(headers);

    const headerData = this.getHeaderData(invokeHeaders);
    const environmentData = this.getEnvironmentData();

    moveXRayHeaderToEnv(invokeHeaders);

    return Object.assign(headerData, environmentData);
  }

  private static getEnvironmentData() {
    return {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION!,
      memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE!,
      logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME!,
      logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME!,
    };
  }

  private static getHeaderData(invokeHeaders: InvokeHeaders) {
    const deadline = this.parseDeadline(invokeHeaders);

    return {
      clientContext: this.parseJsonHeader<Record<string, unknown>>(
        invokeHeaders[OPTIONAL_INVOKE_HEADERS.CLIENT_CONTEXT],
        OPTIONAL_INVOKE_HEADERS.CLIENT_CONTEXT,
      ),
      identity: this.parseJsonHeader<Record<string, unknown>>(
        invokeHeaders[OPTIONAL_INVOKE_HEADERS.COGNITO_IDENTITY],
        OPTIONAL_INVOKE_HEADERS.COGNITO_IDENTITY,
      ),
      invokedFunctionArn: invokeHeaders[REQUIRED_INVOKE_HEADERS.FUNCTION_ARN],
      awsRequestId: invokeHeaders[REQUIRED_INVOKE_HEADERS.REQUEST_ID],
      tenantId: invokeHeaders[OPTIONAL_INVOKE_HEADERS.TENANT_ID],
      xRayTraceId: invokeHeaders[OPTIONAL_INVOKE_HEADERS.X_RAY_TRACE_ID],
      getRemainingTimeInMillis: function () {
        return deadline - Date.now();
      },
    };
  }

  private static parseDeadline(invokeHeaders: InvokeHeaders) {
    const deadline = parseInt(
      invokeHeaders[REQUIRED_INVOKE_HEADERS.DEADLINE_MS],
      10,
    );

    if (isNaN(deadline)) {
      throw new PlatformError("Invalid deadline timestamp");
    }
    return deadline;
  }

  private static validateEnvironment(): void {
    const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

    if (missing.length > 0) {
      throw new PlatformError(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
    }
  }

  private static validateAndNormalizeHeaders(
    headers: Record<string, string>,
  ): InvokeHeaders {
    const normalizedHeaders = this.normalizeHeaders(headers);

    const missingHeaders = this.checkForMissingHeaders(normalizedHeaders);
    if (missingHeaders.length > 0) {
      throw new PlatformError(
        `Missing required headers: ${missingHeaders.join(", ")}`,
      );
    }

    return this.addKnownHeaders(normalizedHeaders);
  }

  private static normalizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
  }

  private static checkForMissingHeaders(
    normalizedHeaders: Record<string, string>,
  ): string[] {
    return Object.values(REQUIRED_INVOKE_HEADERS).filter(
      (requiredKey) => !(requiredKey.toLowerCase() in normalizedHeaders),
    );
  }

  private static addKnownHeaders(
    normalizedHeaders: Record<string, string>,
  ): InvokeHeaders {
    const result = {} as InvokeHeaders;

    // Add required headers
    for (const headerKey of Object.values(REQUIRED_INVOKE_HEADERS)) {
      const lowerKey = headerKey.toLowerCase();
      result[headerKey] = normalizedHeaders[lowerKey];
    }

    // Add optional headers if they exist
    for (const headerKey of Object.values(OPTIONAL_INVOKE_HEADERS)) {
      const lowerKey = headerKey.toLowerCase();
      if (lowerKey in normalizedHeaders) {
        result[headerKey] = normalizedHeaders[lowerKey];
      }
    }

    return result;
  }

  private static parseJsonHeader<T>(
    headerValue: string | undefined,
    headerName: string,
  ): T | undefined {
    if (!headerValue) return undefined;
    try {
      return JSON.parse(headerValue) as T;
    } catch (error) {
      throw new PlatformError(
        `Failed to parse ${headerName} as JSON: ${(error as Error).message}`,
      );
    }
  }
}
