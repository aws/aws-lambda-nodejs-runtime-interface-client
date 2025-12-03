import http, { IncomingMessage, ServerResponse } from "http";
import type { AddressInfo } from "net";

export interface RecordedRequest {
  method: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  trailers: http.IncomingHttpHeaders;
}

export async function withTestServer<T>(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  fn: (port: number, recorded: RecordedRequest[]) => Promise<T>,
): Promise<T> {
  const recorded: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    // Prepare a new record
    const record: RecordedRequest = {
      method: req.method || "GET",
      headers: req.headers,
      body: Buffer.alloc(0),
      trailers: {},
    };
    handler(req, res);

    // Accumulate body
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.once("end", () => {
      record.body = Buffer.concat(chunks);
      record.trailers = req.trailers || {};
      recorded.push(record);
    });

    req.once("error", (err) => {
      // Ensure the record still exists even on errors
      record.trailers = req.trailers || {};
      res.destroy(err);
      recorded.push(record);
    });
  });

  // Start listening
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port: 0, host: "127.0.0.1" }, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;

  try {
    return await fn(port, recorded);
  } finally {
    // Teardown
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}
