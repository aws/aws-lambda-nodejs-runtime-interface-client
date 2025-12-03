import { describe, it, expect, beforeEach, afterEach } from "vitest";
import net from "net";
import fs from "fs";
import path from "path";
import os from "os";
import { acquireSocketFd, PlatformError } from "../../../src/utils";

describe("socket", () => {
  let testSocketPath: string;
  let testServer: net.Server | null = null;
  let activeConnections: net.Socket[] = [];

  beforeEach(() => {
    testSocketPath = path.join(
      os.tmpdir(),
      `test-telemetry-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    );
    activeConnections = [];
  });

  afterEach(async () => {
    // Close all active connections first
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

    // Then close the server
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer!.close((err) => {
          if (err) console.warn("Server close error:", err);
          testServer = null;
          resolve();
        });
      });
    }

    // Clean up socket file
    try {
      if (fs.existsSync(testSocketPath)) {
        fs.unlinkSync(testSocketPath);
      }
    } catch (error) {
      console.warn("Socket file cleanup error:", error);
    }
  });

  const createTestServer = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      testServer = net.createServer((socket) => {
        activeConnections.push(socket);

        socket.on("close", () => {
          const index = activeConnections.indexOf(socket);
          if (index > -1) {
            activeConnections.splice(index, 1);
          }
        });
      });

      testServer.on("error", reject);

      testServer.listen(testSocketPath, () => {
        resolve();
      });
    });
  };

  describe("acquireSocketFd", () => {
    it("should return valid file descriptor when socket connects successfully", async () => {
      // GIVEN
      await createTestServer();
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = testSocketPath;

      // WHEN
      const result = await acquireSocketFd();

      // THEN
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
      expect(() => fs.writeSync(result, "test")).not.toThrow();

      // Cleanup
      delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;
    });

    it("should return stdout fd (1) when socket env var is not set", async () => {
      // GIVEN - ensure no environment variable is set
      delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;

      // WHEN
      const result = await acquireSocketFd();

      // THEN
      expect(result).toBe(1);
      expect(() => fs.writeSync(result, "test")).not.toThrow();
    });

    it("should reject when socket path does not exist", async () => {
      // GIVEN
      const nonExistentPath = path.join(
        os.tmpdir(),
        "non-existent-socket.sock",
      );
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = nonExistentPath;

      // WHEN & THEN
      await expect(acquireSocketFd()).rejects.toThrow(PlatformError);
      await expect(acquireSocketFd()).rejects.toThrow(
        "Failed to connect to telemetry socket:",
      );

      // Cleanup
      delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;
    });

    it("should handle multiple concurrent connections", async () => {
      // GIVEN
      await createTestServer();
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = testSocketPath;

      // WHEN
      const connectionPromises = Array.from({ length: 3 }, () =>
        // Reduced from 5 to 3
        acquireSocketFd(),
      );
      const results = await Promise.all(connectionPromises);

      // THEN
      expect(results).toHaveLength(3);
      results.forEach((fd) => {
        expect(typeof fd).toBe("number");
        expect(fd).toBeGreaterThan(0);
      });

      const uniqueFds = new Set(results);
      expect(uniqueFds.size).toBe(3);

      // Cleanup
      delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;
    });

    it("should allow writing data through the acquired file descriptor", async () => {
      // GIVEN
      const receivedData: Buffer[] = [];
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = testSocketPath;

      testServer = net.createServer((clientSocket) => {
        activeConnections.push(clientSocket);

        clientSocket.on("data", (data) => {
          receivedData.push(data);
        });

        clientSocket.on("close", () => {
          const index = activeConnections.indexOf(clientSocket);
          if (index > -1) {
            activeConnections.splice(index, 1);
          }
        });
      });

      await new Promise<void>((resolve, reject) => {
        testServer!.listen(testSocketPath, () => {
          resolve();
        });

        testServer!.on("error", reject);
      });

      // WHEN
      const fd = await acquireSocketFd();

      const testMessage = "Hello from test!\n";
      fs.writeSync(fd, testMessage);

      // Give server time to receive data
      await new Promise((resolve) => setTimeout(resolve, 100));

      // THEN
      const allReceivedData = Buffer.concat(receivedData).toString();
      expect(allReceivedData).toContain(testMessage);

      // Cleanup
      delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;
    });
  });
});
