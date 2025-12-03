import type {
  IncomingMessage,
  ClientRequest,
  Agent,
  RequestOptions,
} from "http";
import { WritableResponseStream } from "../stream/index.js";

export interface InvocationRequest {
  bodyJson: string;
  headers: Record<string, string>;
}

export interface NativeClient {
  next(): Promise<InvocationRequest>;
  done(id: string, response: string): void;
  error(id: string, errorResponse: string, xrayResponse: string): void;
}

export interface HttpClient {
  Agent: new (options: AgentOptions) => Agent;
  request(
    options: RequestOptions,
    callback: (res: IncomingMessage) => void,
  ): ClientRequest;
}

export interface AgentOptions {
  keepAlive: boolean;
  maxSockets: number;
}

export interface ResponseStreamOptions {
  httpOptions: {
    agent: Agent;
    http: HttpClient;
    hostname: string;
    method: string;
    port: number;
    path: string;
    highWaterMark?: number;
  };
  contentType?: string;
}

export interface RAPIDClientDependencies {
  httpModule?: HttpClient;
  nativeClient?: NativeClient;
}

export interface PostOptions {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers: Record<string, string | number>;
  agent: Agent;
}

export interface InvocationStreamResponse {
  request: WritableResponseStream;
  responseDone: Promise<Buffer>;
}
