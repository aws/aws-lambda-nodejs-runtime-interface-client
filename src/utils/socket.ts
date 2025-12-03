import { PlatformError } from "./errors.js";
import { cjsRequire } from "./cjs-require.js";

const { createConnection } = cjsRequire("node:net");

export async function acquireSocketFd(): Promise<number> {
  // If no socket env var is set, default to stdout for local testing
  if (!process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET) {
    return 1;
  }

  const socketPath = process.env._LAMBDA_TELEMETRY_LOG_FD_PROVIDER_SOCKET;

  return new Promise((resolve, reject) => {
    try {
      const socket = createConnection(socketPath);

      socket.once("error", (err: Error) => {
        reject(
          new PlatformError(
            `Failed to connect to telemetry socket: ${err.message}`,
          ),
        );
      });

      socket.once("connect", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handle = (socket as any)._handle;
        if (handle && typeof handle.fd === "number") {
          resolve(handle.fd);
        } else {
          reject(new PlatformError("Socket file descriptor not available"));
        }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      reject(
        new PlatformError(
          `Failed to connect to telemetry socket: ${errorMessage}`,
        ),
      );
    }
  });
}
