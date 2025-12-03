import { JSONStringifyError } from "./errors.js";

export function serializeToJSON(value: unknown): string {
  try {
    return JSON.stringify(value === undefined ? null : value);
  } catch {
    throw new JSONStringifyError("Unable to stringify response body");
  }
}
