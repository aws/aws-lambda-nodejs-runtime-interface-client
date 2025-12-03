import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { acquireSocketFd } from "./socket.js";
import { PlatformError } from "./errors.js";

vi.mock("module", () => {
  const mockCreateConnection = vi.fn();
  return {
    createRequire: () => (module: string) => {
      if (module === "node:net") {
        return { createConnection: mockCreateConnection };
      }
      return vi.importActual(module);
    },
  };
});

describe("socket-fd", () => {
  const mockSocket = {
    _handle: { fd: 42 },
    once: vi.fn(),
    destroy: vi.fn(),
  };

  let mockCreateConnection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked createConnection function
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const net = require("node:net");
    mockCreateConnection = net.createConnection;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;
  });

  describe("acquireSocketFd", () => {
    it("should use environment variable for socket path", async () => {
      // GIVEN
      const customPath = "/tmp/custom-telemetry.sock";
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET = customPath;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateConnection.mockReturnValue(mockSocket as any);

      mockSocket.once.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        (event: string, callback: Function) => {
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          }
          return mockSocket;
        },
      );

      // WHEN
      const result = await acquireSocketFd();

      // THEN
      expect(result).toBe(42);
      expect(mockCreateConnection).toHaveBeenCalledWith(customPath);
      expect(mockSocket.once).toHaveBeenCalledWith(
        "connect",
        expect.any(Function),
      );
      expect(mockSocket.once).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
    });

    it("should reject with PlatformError when socket connection fails", async () => {
      // GIVEN
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET =
        "/run/telemetry/log-runtime-stdio.sock";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateConnection.mockReturnValue(mockSocket as any);

      const connectionError = new Error("Connection refused");
      mockSocket.once.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        (event: string, callback: Function) => {
          if (event === "error") {
            setTimeout(() => callback(connectionError), 0);
          }
          return mockSocket;
        },
      );

      // WHEN & THEN
      await expect(acquireSocketFd()).rejects.toThrow(PlatformError);
      await expect(acquireSocketFd()).rejects.toThrow(
        "Failed to connect to telemetry socket: Connection refused",
      );
    });

    it("should reject with PlatformError when socket handle is not available", async () => {
      // GIVEN
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET =
        "/run/telemetry/log-runtime-stdio.sock";
      const socketWithoutHandle = {
        _handle: null,
        once: vi.fn(),
        destroy: vi.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateConnection.mockReturnValue(socketWithoutHandle as any);

      socketWithoutHandle.once.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        (event: string, callback: Function) => {
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          }
          return socketWithoutHandle;
        },
      );

      // WHEN & THEN
      await expect(acquireSocketFd()).rejects.toThrow(PlatformError);
      await expect(acquireSocketFd()).rejects.toThrow(
        "Socket file descriptor not available",
      );
    });

    it("should reject with PlatformError when fd is not a number", async () => {
      // GIVEN
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET =
        "/run/telemetry/log-runtime-stdio.sock";
      const socketWithInvalidFd = {
        _handle: { fd: "not-a-number" },
        once: vi.fn(),
        destroy: vi.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateConnection.mockReturnValue(socketWithInvalidFd as any);

      socketWithInvalidFd.once.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        (event: string, callback: Function) => {
          if (event === "connect") {
            setTimeout(() => callback(), 0);
          }
          return socketWithInvalidFd;
        },
      );

      // WHEN & THEN
      await expect(acquireSocketFd()).rejects.toThrow(PlatformError);
      await expect(acquireSocketFd()).rejects.toThrow(
        "Socket file descriptor not available",
      );
    });

    it("should reject with PlatformError when socket creation throws", async () => {
      // GIVEN
      process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET =
        "/run/telemetry/log-runtime-stdio.sock";
      mockCreateConnection.mockImplementation(() => {
        throw new Error("Socket creation failed");
      });

      // WHEN & THEN
      await expect(acquireSocketFd()).rejects.toThrow(PlatformError);
      await expect(acquireSocketFd()).rejects.toThrow(
        "Failed to connect to telemetry socket: Socket creation failed",
      );
    });

    it("should return stdout fd (1) when socket env var is not set", async () => {
      // GIVEN - no environment variable set
      delete process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;

      // WHEN
      const result = await acquireSocketFd();

      // THEN
      expect(result).toBe(1);
      expect(mockCreateConnection).not.toHaveBeenCalled();
    });
  });
});
