import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { withTestServer } from "../utils/test-server";
import {
  createResponseStream,
  tryCallFail,
} from "../../../src/stream/response-stream";
import http from "http";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { Throttle } from "../utils/throttle";
import {
  DEFAULT_CONTENT_TYPE,
  HEADER_RESPONSE_MODE,
  TRAILER_NAME_ERROR_BODY,
  TRAILER_NAME_ERROR_TYPE,
  VALUE_STREAMING,
} from "../../../src/stream/constants";
import { InvalidStreamingOperation } from "../../../src/utils/index";
import { HttpResponseStream } from "../../../src/stream/http-response-stream";

describe("response-stream", () => {
  describe("createResponseStream", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("rejects with ECONNRESET if the client never ends the request", async () => {
      await withTestServer(
        // GIVEN
        // server handler: destroy the socket if no end arrives
        (req) => {
          let ended = false;
          req.once("end", () => {
            ended = true;
          });
          setTimeout(() => {
            if (!ended) {
              const err = new Error("Connection reset by peer");
              // attach the standard code so our client sees it
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (err as any).code = "ECONNRESET";
              req.socket.destroy(err);
            }
          }, 200);
          vi.runAllTimers();
        },

        // WHEN
        async (port) => {
          const { request, responseDone, headersDone } = createResponseStream({
            contentType: "moon/dust",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          headersDone.catch(() => {});

          // Write one byte, but never call end()
          request.write(Buffer.from([1]));
          // The stream shouldn't consider itself finished yet
          expect(request.writableFinished).toBe(false);

          // THEN
          await expect(responseDone).rejects.toMatchObject({
            code: "ECONNRESET",
          });
        },
      );
    });

    it("can pipeline a small Readable into the streaming client", async () => {
      await withTestServer(
        // Server handler: immediately respond once the request ends
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        async (port, recorded) => {
          // GIVEN
          const input = Readable.from(Buffer.from("moon"));

          // WHEN
          const { request, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          await pipeline(input, request);
          await responseDone.catch(() => {});

          // THEN
          expect(recorded).toHaveLength(1);
          expect(recorded[0].body.toString()).toBe("moon");
        },
      );
    });

    it("can pipeline with throttle", async () => {
      await withTestServer(
        // GIVEN
        // server handler: a server that just ends when request finishes
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        // throttle a large stream into createResponseStream
        async (port, recorded) => {
          // build a 5KB-ish payload: "moon " x1000 ~5000 bytes
          const payload = "moon ".repeat(1000);
          const input = Readable.from(Buffer.from(payload));

          const { request, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          // THEN
          // pipeline through our Throttle at ~20KB/s (fast enough)
          await pipeline(
            input,
            new Throttle({ bps: 20000, chunkSize: 2 }),
            request,
          );

          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);
          expect(recorded[0].body.toString()).toBe(payload);
        },
      );
    });

    it("can pipeline with throttle extremly slow throttle", async () => {
      await withTestServer(
        // GIVEN
        // server handler: a server that ends as soon as the request finishes
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const payload = "moon";
          const input = Readable.from(Buffer.from(payload));

          const { request, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          // Use an ultra‐slow throttle: 1 byte per second, chunkSize=1
          await pipeline(
            input,
            new Throttle({ bps: 1, chunkSize: 1 }),
            request,
          );
          await responseDone.catch(() => {});

          // THEN
          expect(recorded).toHaveLength(1);
          expect(recorded[0].body.toString()).toBe(payload);
        },
      );
    });

    it("can pipeline generator function", async () => {
      await withTestServer(
        // GIVEN
        // server handler: a server that ends the response once the request ends
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          async function* generateContent() {
            // Push 1 KiB of data in 1 KiB chunks, 100 times
            for (let i = 1; i <= 100; i++) {
              yield (i % 10).toString().repeat(1024);
            }
          }

          const { request, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          await pipeline(generateContent(), request);
          await responseDone.catch(() => {});

          // THEN
          expect(recorded).toHaveLength(1);

          let expected = "";
          for await (const chunk of generateContent()) {
            expected += chunk;
          }
          expect(recorded[0].body.toString()).toBe(expected);
        },
      );
    });

    it("write returns true", async () => {
      await withTestServer(
        // GIVEN
        // server handler: a server that immediately responds once the request ends
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          // THEN
          const result = request.write("moon");
          expect(result).toBe(true);

          request.end();
          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);
          expect(recorded[0].body.toString()).toBe("moon");
        },
      );
    });

    it("uses the default content-type when none is set", async () => {
      await withTestServer(
        // GIVEN
        // server handler: a server that ends immediately once the request ends
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, responseDone } = createResponseStream({
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          request.end();
          await responseDone.catch(() => {});

          // THEN
          expect(recorded).toHaveLength(1);
          const headers = recorded[0].headers;
          expect(headers["content-type"]).toBe(DEFAULT_CONTENT_TYPE);
          expect(headers[HEADER_RESPONSE_MODE.toLowerCase()]).toBe(
            VALUE_STREAMING,
          );
        },
      );
    });

    it("doesn't throw when calling setContentType before any write", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, responseDone } = createResponseStream({
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          request.setContentType("moon/dust");

          // THEN
          request.end();
          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);
          const hdrs = recorded[0].headers;
          expect(hdrs["content-type"]).toBe("moon/dust");
          expect(hdrs[HEADER_RESPONSE_MODE.toLowerCase()]).toBe(
            VALUE_STREAMING,
          );
        },
      );
    });

    it("uses the contentType option when provided", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, responseDone } = createResponseStream({
            contentType: "moon/dust",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          request.end();
          await responseDone.catch(() => {});

          // THEN
          expect(recorded).toHaveLength(1);
          const hdrs = recorded[0].headers;
          expect(hdrs["content-type"]).toBe("moon/dust");
          expect(hdrs[HEADER_RESPONSE_MODE.toLowerCase()]).toBe(
            VALUE_STREAMING,
          );
        },
      );
    });

    it("allows overriding the contentType option via setContentType", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, responseDone } = createResponseStream({
            contentType: "moon/flake", // initial option
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          // override before any write
          request.setContentType("moon/dust");

          // THEN
          request.end();
          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);
          const hdrs = recorded[0].headers;
          expect(hdrs["content-type"]).toBe("moon/dust");
          expect(hdrs[HEADER_RESPONSE_MODE.toLowerCase()]).toBe(
            VALUE_STREAMING,
          );
        },
      );
    });

    it("throws InvalidStreamingOperation when calling setContentType after first write", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port) => {
          const { request, responseDone, headersDone } = createResponseStream({
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          headersDone.catch(() => {});

          request.write(JSON.stringify({}));

          // THEN
          expect(() => {
            request.setContentType("moon/trust");
          }).toThrow(InvalidStreamingOperation);

          request.end();
          await responseDone.catch(() => {});
        },
      );
    });

    it("throws InvalidStreamingOperation when calling setContentType after first write (non-default)", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port) => {
          const { request, responseDone, headersDone } = createResponseStream({
            contentType: "moon/dust", // non-default initial
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          headersDone.catch(() => {});

          request.setContentType("moon/flake");

          request.write(Buffer.from([1, 2, 3, 2, 1]));

          // THEN
          expect(() => {
            request.setContentType("moon/trust");
          }).toThrow(InvalidStreamingOperation);

          request.end();
          await responseDone.catch(() => {});
        },
      );
    });

    it("sends error in trailer when fail is invoked", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, headersDone, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          headersDone.catch(() => {});

          tryCallFail(request, 42);

          // THEN
          request.end();
          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);
          const trailers = recorded[0].trailers;
          expect(trailers[TRAILER_NAME_ERROR_TYPE.toLowerCase()]).toBe(
            "number",
          );

          const raw = trailers[TRAILER_NAME_ERROR_BODY.toLowerCase()]!;
          const rawStr = Array.isArray(raw) ? raw[0] : raw;
          const decoded = JSON.parse(Buffer.from(rawStr, "base64").toString());
          expect(decoded).toEqual({
            errorType: "number",
            errorMessage: "42",
            trace: [],
          });
        },
      );
    });

    it("sends InvalidStreamingOperation in trailer", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, headersDone, responseDone } = createResponseStream({
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          headersDone.catch(() => {});

          const error = new InvalidStreamingOperation(
            "Cannot set content-type, too late.",
          );
          tryCallFail(request, error);

          // THEN
          request.end();
          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);
          const trailers = recorded[0].trailers;

          const rawType = trailers[TRAILER_NAME_ERROR_TYPE.toLowerCase()];
          const type = Array.isArray(rawType) ? rawType[0] : rawType;
          expect(type).toBe("Runtime.InvalidStreamingOperation");

          const rawBody = trailers[TRAILER_NAME_ERROR_BODY.toLowerCase()]!;
          const bodyEncoded = Array.isArray(rawBody) ? rawBody[0] : rawBody;
          const decoded = JSON.parse(
            Buffer.from(bodyEncoded, "base64").toString(),
          );

          expect(decoded.errorType).toBe("Runtime.InvalidStreamingOperation");
          expect(decoded.errorMessage).toBe(
            "Cannot set content-type, too late.",
          );
          expect(
            Array.isArray(decoded.trace) && decoded.trace.length,
          ).toBeGreaterThan(0);
        },
      );
    });

    it("sends error in trailer and invokes the callback from fail", async () => {
      await withTestServer(
        // GIVEN
        (req, res) => {
          req.once("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end();
          });
        },

        // WHEN
        async (port, recorded) => {
          const { request, headersDone, responseDone } = createResponseStream({
            contentType: "application/octet-stream",
            httpOptions: {
              http,
              agent: new http.Agent(),
              method: "POST",
              hostname: "127.0.0.1",
              port,
              path: "/asd/efg",
              highWaterMark: 16,
            },
          });

          headersDone.catch(() => {});

          const callbackInvoked = tryCallFail(request, 42);

          // THEN
          await callbackInvoked;

          await responseDone.catch(() => {});

          expect(recorded).toHaveLength(1);

          const trailers = recorded[0].trailers;

          const rawType = trailers[TRAILER_NAME_ERROR_TYPE.toLowerCase()];
          const type = Array.isArray(rawType) ? rawType[0] : rawType;
          expect(type).toBe("number");

          const rawBody = trailers[TRAILER_NAME_ERROR_BODY.toLowerCase()]!;
          const bodyEncoded = Array.isArray(rawBody) ? rawBody[0] : rawBody;
          const decoded = JSON.parse(
            Buffer.from(bodyEncoded, "base64").toString(),
          );

          expect(decoded).toEqual({
            errorType: "number",
            errorMessage: "42",
            trace: [],
          });
        },
      );
    });
  });

  it("overrides content type and prepends metadata prelude", async () => {
    await withTestServer(
      // GIVEN
      (req, res) => {
        req.once("end", () => {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end();
        });
      },

      // WHEN
      async (port, recorded) => {
        const { request, responseDone } = createResponseStream({
          contentType: "moon/flake",
          httpOptions: {
            http,
            agent: new http.Agent(),
            method: "POST",
            hostname: "127.0.0.1",
            port,
            path: "/asd/efg",
            highWaterMark: 16,
          },
        });

        // apply the metadata prelude transformer
        const wrapped = HttpResponseStream.from(request, {
          loc: "mare\u0000tranquillitatis",
        });

        wrapped.write("ABC");
        wrapped.end();
        await responseDone.catch(() => {});

        // THEN
        expect(recorded).toHaveLength(1);

        const headers = recorded[0].headers;
        expect(headers["content-type"]).toBe(
          "application/vnd.awslambda.http-integration-response",
        );
        expect(headers[HEADER_RESPONSE_MODE.toLowerCase()]).toBe(
          VALUE_STREAMING,
        );

        // build expected body: JSON prelude + 8 null bytes + 'ABC'
        const metaJson = JSON.stringify({ loc: "mare\u0000tranquillitatis" });
        const nullBytes = "\u0000".repeat(8);
        const expected = metaJson + nullBytes + "ABC";

        expect(recorded[0].body.toString("utf8")).toBe(expected);
      },
    );
  });

  it("applies metadata prelude even when ignoring the return value of from()", async () => {
    await withTestServer(
      // Server: end as soon as the request ends
      (req, res) => {
        req.once("end", () => {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end();
        });
      },

      async (port, recorded) => {
        // GIVEN
        const { request, responseDone } = createResponseStream({
          httpOptions: {
            http,
            agent: new http.Agent(),
            method: "POST",
            hostname: "127.0.0.1",
            port,
            path: "/asd/efg",
            highWaterMark: 16,
          },
        });

        // WHEN
        HttpResponseStream.from(request, {
          loc: "mare\u0000tranquillitatis",
        });

        request.write("ABC");
        request.end();
        await responseDone.catch(() => {});

        // THEN
        expect(recorded).toHaveLength(1);

        const headers = recorded[0].headers;
        expect(headers["content-type"]).toBe(
          "application/vnd.awslambda.http-integration-response",
        );
        expect(headers[HEADER_RESPONSE_MODE.toLowerCase()]).toBe(
          VALUE_STREAMING,
        );

        // Reconstruct expected body
        const metaJson = JSON.stringify({ loc: "mare\u0000tranquillitatis" });
        const nullBytes = "\u0000".repeat(8);
        const expected = metaJson + nullBytes + "ABC";
        expect(recorded[0].body.toString("utf8")).toBe(expected);
      },
    );
  });
});
