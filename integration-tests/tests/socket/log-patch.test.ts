import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import net from "net";
import fs from "fs";
import path from "path";
import os from "os";
import { LogPatch } from "../../../src/logging/log-patch.js";

describe("SocketLogger Integration", () => {
  let testSocketPath: string;
  let testServer: net.Server | null = null;
  let activeConnections: net.Socket[] = [];
  let receivedData: Buffer[] = [];

  beforeEach(() => {
    testSocketPath = path.join(
      os.tmpdir(),
      `test-logging-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    );
    activeConnections = [];
    receivedData = [];

    // Set multi-concurrent mode
    process.env.AWS_LAMBDA_MAX_CONCURRENCY = "10";
  });

  afterEach(async () => {
    // Cleanup connections
    await Promise.all(
      activeConnections.map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (!socket.destroyed) {
              socket.once("close", () => resolve());
              socket.destroy();
            } else {
              resolve();
            }
          }),
      ),
    );
    activeConnections = [];

    // Cleanup server
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer!.close(() => {
          testServer = null;
          resolve();
        });
      });
    }

    // Cleanup files and env
    try {
      if (fs.existsSync(testSocketPath)) {
        fs.unlinkSync(testSocketPath);
      }
    } catch (error) {
      console.warn("Socket cleanup error:", error);
    }

    delete process.env.AWS_LAMBDA_MAX_CONCURRENCY;
    delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;
  });

  const createTestServer = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      testServer = net.createServer((socket) => {
        activeConnections.push(socket);

        socket.on("data", (data) => {
          receivedData.push(data);
        });

        socket.on("close", () => {
          const index = activeConnections.indexOf(socket);
          if (index > -1) {
            activeConnections.splice(index, 1);
          }
        });
      });

      testServer.on("error", reject);
      testServer.listen(testSocketPath, resolve);
    });
  };

  it("should log to socket in multi-concurrent mode", async () => {
    // GIVEN
    await createTestServer();
    process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = testSocketPath;

    // WHEN
    await LogPatch.patchConsole();
    console.info("test message from socket logger");

    // Give server time to receive data
    await new Promise((resolve) => setTimeout(resolve, 100));

    // THEN
    const allReceivedData = Buffer.concat(receivedData).toString();
    expect(allReceivedData).toContain("test message from socket logger");
    expect(allReceivedData).toContain('"level":"INFO"');
    expect(allReceivedData).toContain('"timestamp"');
  });

  it("should fallback to stdout when socket env var not set", async () => {
    // GIVEN - no socket env var set
    const originalWriteSync = fs.writeSync;
    let stdoutData = "";

    // Mock fs.writeSync to capture writes to FD 1 (stdout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fs.writeSync = vi.fn().mockImplementation((fd: number, data: any) => {
      if (fd === 1) {
        const text = typeof data === "string" ? data : data.toString();
        stdoutData += text;
      }
      return typeof data === "string" ? data.length : data.length;
    });

    try {
      // WHEN
      await LogPatch.patchConsole();
      console.info("test message to stdout");

      // THEN
      expect(fs.writeSync).toHaveBeenCalledWith(1, expect.any(String));
      expect(stdoutData).toContain("test message to stdout");
      expect(stdoutData).toContain('"level":"INFO"');
    } finally {
      fs.writeSync = originalWriteSync;
    }
  });

  it("should handle multiple log levels", async () => {
    // GIVEN
    await createTestServer();
    process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = testSocketPath;

    // WHEN
    await LogPatch.patchConsole();
    console.info("info message");
    console.warn("warn message");
    console.error("error message");

    await new Promise((resolve) => setTimeout(resolve, 100));

    // THEN
    const allReceivedData = Buffer.concat(receivedData).toString();
    expect(allReceivedData).toContain('"level":"INFO"');
    expect(allReceivedData).toContain('"level":"WARN"');
    expect(allReceivedData).toContain('"level":"ERROR"');
    expect(allReceivedData).toContain("info message");
    expect(allReceivedData).toContain("warn message");
    expect(allReceivedData).toContain("error message");
  });
});
