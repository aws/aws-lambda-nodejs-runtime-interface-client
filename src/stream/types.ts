import type { ClientRequest, IncomingHttpHeaders } from "http";
import { STATUS_READY, STATUS_WRITE_CALLED } from "./constants.js";
import { WritableResponseStream } from "./response-stream.js";

export type ResponseStreamStatus =
  | typeof STATUS_READY
  | typeof STATUS_WRITE_CALLED;

export interface ResponseStream extends ClientRequest {
  setContentType(contentType: string): void;
  _onBeforeFirstWrite?: (writeFn: (chunk: unknown) => void) => void;
}

export interface HttpResponseStreamOptions {
  statusCode?: number;
  headers?: Record<string, string | number | string[]>;
}

export interface CreateResponseStreamResult {
  request: WritableResponseStream;
  headersDone: Promise<HeaderInfo>;
  responseDone: Promise<Buffer>;
}

export interface HeaderInfo {
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
}

export type FailFunction = (err: unknown) => Promise<void>;
