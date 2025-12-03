import {
  NativeClient,
  HttpClient,
  RAPIDClientDependencies,
  InvocationRequest,
  PostOptions,
  InvocationStreamResponse,
} from "./types.js";
import type { Agent as agentType } from "http";
import {
  parseHostPort,
  shouldUseAlternativeClient,
  serializeToJSON,
  formatError,
  formatXRayError,
  NativeClientLoadingError,
  RetryOptions,
  DEFAULT_RETRY_OPTIONS,
  calculateBackoffDelay,
} from "../utils/index.js";

import { StreamOptions } from "../context/types.js";
import { createResponseStream } from "../stream/index.js";
import { structuredConsole } from "../logging/log-patch.js";
import { cjsRequire } from "../utils/cjs-require.js";

const { Agent, request } = cjsRequire("node:http");

export class RAPIDClient {
  private static readonly ERROR_TYPE_HEADER =
    "Lambda-Runtime-Function-Error-Type";

  private readonly hostname: string;
  private readonly port: number;
  private readonly agent: agentType;
  private readonly httpClient: HttpClient;
  private readonly nativeClient: NativeClient;
  private readonly useAlternativeClient: boolean;
  private readonly isMultiConcurrent: boolean;
  private readonly retryOptions: RetryOptions;

  public static async create(
    hostnamePort: string,
    deps: RAPIDClientDependencies = {},
    isMultiConcurrent: boolean = false,
    retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS,
  ): Promise<RAPIDClient> {
    const httpModule = deps.httpModule ?? ({ Agent, request } as HttpClient);
    const nativeClient = deps.nativeClient ?? (await this.loadNativeClient());

    return new RAPIDClient(
      hostnamePort,
      httpModule,
      nativeClient,
      isMultiConcurrent,
      retryOptions,
    );
  }

  private constructor(
    hostnamePort: string,
    httpClient: HttpClient,
    nativeClient: NativeClient,
    isMultiConcurrent: boolean = false,
    retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS,
  ) {
    const { hostname, port } = parseHostPort(hostnamePort);
    this.hostname = hostname;
    this.port = port;
    this.httpClient = httpClient;
    this.nativeClient = nativeClient;
    this.agent = new this.httpClient.Agent({
      keepAlive: true,
      maxSockets: 1,
    });
    this.useAlternativeClient = shouldUseAlternativeClient();
    this.isMultiConcurrent = isMultiConcurrent;
    this.retryOptions = retryOptions;
  }

  public async nextInvocation(): Promise<InvocationRequest> {
    try {
      return await this.nextInvocationOnce();
    } catch (error) {
      if (!this.isMultiConcurrent) {
        throw error;
      }

      return this.retryAfterInitialFailure(error);
    }
  }

  private async nextInvocationOnce(): Promise<InvocationRequest> {
    if (this.useAlternativeClient) {
      return this.nextInvocationHttp();
    }
    return this.nativeClient.next();
  }

  public postInvocationResponse(response: unknown, id: string): void {
    const bodyString = serializeToJSON(response);
    try {
      this.nativeClient.done(encodeURIComponent(id), bodyString);
    } catch (error) {
      if (!this.isMultiConcurrent) {
        throw error;
      }
      structuredConsole.logError(
        `Failed to post invocation response for ${id}`,
        error,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public postInvocationError(error: any, id: string): void {
    try {
      const errorResponse = formatError(error);
      const bodyString = serializeToJSON(errorResponse);
      const xrayString = formatXRayError(error);

      this.nativeClient.error(encodeURIComponent(id), bodyString, xrayString);
    } catch (error) {
      if (!this.isMultiConcurrent) {
        throw error;
      }
      structuredConsole.logError(
        `Failed to post invocation error for ${id}`,
        error,
      );
    }
  }

  public async postInitError(error: unknown): Promise<void> {
    const response = formatError(error);
    try {
      await this.post("/2018-06-01/runtime/init/error", response, {
        [RAPIDClient.ERROR_TYPE_HEADER]: response.errorType,
      });
    } catch (error) {
      structuredConsole.logError(`Failed to post init error`, error);
      throw error;
    }
  }

  public getStreamForInvocationResponse(
    id: string,
    options: StreamOptions | undefined,
  ): InvocationStreamResponse {
    const { request, responseDone } = createResponseStream({
      httpOptions: {
        agent: this.agent,
        http: this.httpClient,
        hostname: this.hostname,
        method: "POST",
        port: this.port,
        path:
          "/2018-06-01/runtime/invocation/" +
          encodeURIComponent(id) +
          "/response",
        highWaterMark: options?.highWaterMark,
      },
    });

    return {
      request,
      responseDone,
    };
  }

  private static async loadNativeClient(): Promise<NativeClient> {
    try {
      return cjsRequire("./rapid-client.node");
    } catch (error) {
      throw new NativeClientLoadingError(
        `Failed to load native client: ${error}`,
      );
    }
  }

  private async nextInvocationHttp(): Promise<InvocationRequest> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: this.port,
        path: "/2018-06-01/runtime/invocation/next",
        method: "GET",
        agent: this.agent,
      };

      const request = this.httpClient.request(options, (response) => {
        let data = "";
        response
          .setEncoding("utf-8")
          .on("data", (chunk) => {
            data += chunk;
          })
          .on("end", () => {
            resolve({
              bodyJson: data,
              headers: response.headers as Record<string, string>,
            });
          });
      });

      request.on("error", reject).end();
    });
  }

  private async post(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<void> {
    const bodyString = serializeToJSON(body);
    const options: PostOptions = {
      hostname: this.hostname,
      port: this.port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.from(bodyString).length,
        ...headers,
      },
      agent: this.agent,
    };

    await new Promise<void>((resolve, reject) => {
      const request = this.httpClient.request(options, (response) => {
        response
          .on("end", resolve)
          .on("error", reject)
          .on("data", () => {}); // consume data to finish the response
      });

      request.on("error", reject);
      request.end(bodyString, "utf-8");
    });
  }

  private async retryAfterInitialFailure(
    initialError: unknown,
  ): Promise<InvocationRequest> {
    let attempts = 1;
    let lastError = initialError;

    while (attempts <= this.retryOptions.maxRetries) {
      const backoffMs = calculateBackoffDelay(attempts - 1, this.retryOptions);

      structuredConsole.logError(
        `Failed to get next invocation (attempt ${attempts}/${
          this.retryOptions.maxRetries + 1
        }). Retrying in ${backoffMs}ms...`,
        lastError,
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));

      try {
        return await this.nextInvocationOnce();
      } catch (error) {
        lastError = error;
        attempts++;

        if (attempts > this.retryOptions.maxRetries) {
          structuredConsole.logError(
            `Failed to get next invocation after ${attempts} attempts. Giving up.`,
            lastError,
          );
          throw lastError;
        }
      }
    }

    throw lastError;
  }
}
