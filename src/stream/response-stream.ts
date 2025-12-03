import type { ClientRequestArgs, IncomingMessage } from "http";
import { ResponseStreamOptions } from "../client/types.js";
import {
  CHUNKED_TRANSFER_ENCODING,
  DEFAULT_CONTENT_TYPE,
  HEADER_CONTENT_TYPE,
  HEADER_RESPONSE_MODE,
  HEADER_TRANSFER_ENCODING,
  STATUS_READY,
  STATUS_WRITE_CALLED,
  TRAILER_NAME_ERROR_BODY,
  TRAILER_NAME_ERROR_TYPE,
  VALUE_STREAMING,
} from "./constants.js";
import {
  CreateResponseStreamResult,
  FailFunction,
  HeaderInfo,
  ResponseStream,
  ResponseStreamStatus,
} from "./types.js";
import { InvalidStreamingOperation } from "../utils/index.js";
import { formatError } from "../utils/index.js";
import { logger } from "../logging/index.js";
import { cjsRequire } from "../utils/cjs-require.js";

const { createConnection } = cjsRequire("node:net");

const log = logger("STREAM");

const failProps = new WeakMap<WritableResponseStream, FailFunction>();

export function addFailWeakProp(
  req: WritableResponseStream,
  fn: FailFunction,
): void {
  failProps.set(req, fn);
}

export async function tryCallFail(
  req: WritableResponseStream,
  err: unknown,
): Promise<boolean> {
  const fn = failProps.get(req);
  if (typeof fn === "function") {
    await fn(err);
    return true;
  }
  return false;
}

const WRITABLE_METHODS = [
  "cork",
  "destroy",
  "end",
  "uncork",
  "write",

  "addListener",
  "on",
  "once",
  "prependListener",
  "prependOnceListener",
  "off",
  "removeListener",
  "removeAllListeners",
  "setMaxListeners",
  "getMaxListeners",
  "listeners",
  "rawListeners",
  "listenerCount",
  "eventNames",
  "emit",

  "setContentType",
] as const;

const PROPS_READ_WRITE = ["destroyed", "_onBeforeFirstWrite"] as const;

const PROPS_READ_ONLY = [
  "writableFinished",
  "writableObjectMode",
  "writableEnded",
  "writableNeedDrain",
  "writableHighWaterMark",
  "writableCorked",
  "writableLength",
  "writable",
] as const;

// This ensures that we only use the functions that are present on the stream prototype
type WritableKeys =
  | (typeof WRITABLE_METHODS)[number]
  | (typeof PROPS_READ_WRITE)[number]
  | (typeof PROPS_READ_ONLY)[number];

export type WritableResponseStream = Pick<ResponseStream, WritableKeys>;

export function toWritableResponseStream(
  inner: ResponseStream,
): WritableResponseStream {
  const stream = {} as WritableResponseStream;
  for (const method of WRITABLE_METHODS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream[method] = inner[method].bind(inner) as any;
  }
  for (const p of PROPS_READ_WRITE) {
    Object.defineProperty(stream, p, {
      get: () => inner[p],
      set: (v) => {
        inner[p] = v;
      },
    });
  }
  for (const p of PROPS_READ_ONLY) {
    Object.defineProperty(stream, p, {
      get: () => inner[p],
    });
  }

  return stream;
}

export function createResponseStream(
  options: ResponseStreamOptions,
): CreateResponseStreamResult {
  let status: ResponseStreamStatus = STATUS_READY;

  const headers = makeResponseStreamHeaders(options);

  // These are used to await on RAPID closing the stream for response
  const headersDone = createDeferred<HeaderInfo>();
  const responseDone = createDeferred<Buffer>();

  const agent = makePatchedAgent(options);

  const req = options.httpOptions.http.request(
    {
      http: options.httpOptions.http,
      method: options.httpOptions.method,
      hostname: options.httpOptions.hostname,
      port: options.httpOptions.port,
      path: options.httpOptions.path,
      headers,
      agent,
    } as ClientRequestArgs,
    (res: IncomingMessage) => {
      headersDone.resolve({
        statusCode: res.statusCode!,
        statusMessage: res.statusMessage!,
        headers: res.headers,
      });

      hookResponseListners(res, responseDone, req);
    },
  ) as ResponseStream;

  req.on("error", (err: Error) => {
    headersDone.reject(err);
    responseDone.reject(err);
    req.destroy(err);
  });

  req.setContentType = (contentType: string) => {
    if (status !== STATUS_READY) {
      throw new InvalidStreamingOperation("Cannot set content-type, too late.");
    }
    req.setHeader("Content-Type", contentType);
  };

  const origWrite = req.write.bind(req);
  // @ts-expect-error: overloads are not preserved after bind
  req.write = (
    chunk: unknown,
    encoding: BufferEncoding,
    callback?: (error: Error | null | undefined) => void,
  ): boolean => {
    log.vvverbose(
      "ResponseStream::write",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chunk as any).length,
      "callback:",
      typeof callback,
    );

    let data = chunk;
    if (
      typeof chunk !== "string" &&
      !Buffer.isBuffer(chunk) &&
      !(chunk instanceof Uint8Array)
    ) {
      data = JSON.stringify(chunk);
    }

    if (
      status === STATUS_READY &&
      typeof req._onBeforeFirstWrite === "function"
    ) {
      req._onBeforeFirstWrite((ch) => origWrite(ch as unknown));
    }

    const ret = origWrite(data, encoding, callback);

    log.vvverbose("ResponseStream::origWrite", ret);

    if (status === STATUS_READY) {
      status = STATUS_WRITE_CALLED;
    }
    return ret;
  };

  const request = toWritableResponseStream(req);

  hookWeakFailProps(request, req);

  return {
    request,
    headersDone: headersDone.promise,
    responseDone: responseDone.promise,
  };
}

function hookWeakFailProps(
  request: WritableResponseStream,
  req: ResponseStream,
) {
  addFailWeakProp(request, async (err: unknown) => {
    log.verbose("ResponseStream::fail err:", err);

    const error = formatError(err);
    req.addTrailers({
      [TRAILER_NAME_ERROR_TYPE]: error.errorType,
      [TRAILER_NAME_ERROR_BODY]: Buffer.from(JSON.stringify(error)).toString(
        "base64",
      ),
    });
    await new Promise((resolve) => {
      req.end(resolve);
    });
  });
}

function hookResponseListners(
  res: IncomingMessage,
  responseDone: {
    promise: Promise<Buffer>;
    resolve: (v: Buffer) => void;
    reject: (e: unknown) => void;
  },
  req: ResponseStream,
) {
  let buf: Buffer | undefined;
  res.on("data", (chunk: Buffer) => {
    buf = buf === undefined ? chunk : Buffer.concat([buf, chunk]);
  });

  res.on("aborted", (err: Error) => {
    responseDone.reject(err);
    req.destroy(err);
  });

  res.on("end", () => {
    log.vvverbose("rapid response", buf ? buf.toString() : "buf undefined");
    responseDone.resolve(buf!);
  });
  return buf;
}

function makePatchedAgent(options: ResponseStreamOptions) {
  const agent = options.httpOptions.agent;
  // ? TypeScript does not expose http.Agent.createConnection although the function does exist: https://nodejs.org/api/http.html#agentcreateconnectionoptions-callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (agent as any).createConnection = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts: any,
    connectionListener?: () => void,
  ) => {
    return createConnection(
      {
        ...opts,
        highWaterMark: options.httpOptions.highWaterMark,
      },
      connectionListener,
    );
  };
  return agent;
}

function makeResponseStreamHeaders(options: ResponseStreamOptions) {
  return {
    [HEADER_RESPONSE_MODE]: VALUE_STREAMING,
    Trailer: [TRAILER_NAME_ERROR_TYPE, TRAILER_NAME_ERROR_BODY],
    [HEADER_CONTENT_TYPE]: options.contentType ?? DEFAULT_CONTENT_TYPE,
    [HEADER_TRANSFER_ENCODING]: CHUNKED_TRANSFER_ENCODING,
  };
}

function createDeferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
