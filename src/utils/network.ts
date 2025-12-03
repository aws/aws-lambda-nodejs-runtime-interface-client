import { PlatformError } from "./errors.js";

interface HostPort {
  hostname: string;
  port: number;
}

export function parseHostPort(hostnamePort: string): HostPort {
  const parts = hostnamePort.split(":");
  if (parts.length !== 2) {
    throw new PlatformError(`Invalid hostnamePort: ${hostnamePort}`);
  }

  const [hostname, portString] = parts;

  if (!hostname || hostname.trim().length === 0) {
    throw new PlatformError(`Invalid hostnamePort: ${hostnamePort}`);
  }

  if (!isValidPort(portString)) {
    throw new PlatformError(`Invalid hostnamePort: ${hostnamePort}`);
  }

  const port = Number(portString);
  return { hostname, port };
}

export function isValidPort(portString: string): boolean {
  const port = Number(portString);
  return (
    Number.isFinite(port) &&
    Number.isInteger(port) &&
    port >= 0 &&
    port <= 65535 &&
    port.toString() === portString
  );
}
