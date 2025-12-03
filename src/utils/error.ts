import { FORMAT } from "../logging/index.js";

interface RapidError {
  errorType: string;
  errorMessage: string;
  trace: string[];
}

export function formatError(error: unknown): RapidError {
  try {
    if (error instanceof Error) {
      return {
        // Replace ASCII DEL character (\x7F) with %7F
        errorType: error.name?.replaceAll("\x7F", "%7F"),
        errorMessage: error.message?.replaceAll("\x7F", "%7F"),
        trace: error.stack?.replaceAll("\x7F", "%7F").split("\n") || [],
      };
    }
    return {
      errorType: typeof error,
      errorMessage: String(error),
      trace: [],
    };
  } catch {
    return {
      errorType: "handled",
      errorMessage:
        "callback called with Error argument, but there was a problem while retrieving one or more of its message, name, and stack",
      trace: [],
    };
  }
}

export function intoError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

export function toFormatted(error: Error): string {
  try {
    return (
      FORMAT.FIELD_DELIMITER +
      JSON.stringify(error, (_k, v) => withEnumerableProperties(v))
    );
  } catch {
    return FORMAT.FIELD_DELIMITER + JSON.stringify(formatError(error));
  }
}

function withEnumerableProperties(error: unknown): unknown {
  if (error instanceof Error) {
    const ret = Object.assign(
      {
        errorType: error.name,
        errorMessage: error.message,
        code: (error as Error & { code?: unknown }).code,
      },
      error,
    );
    if (typeof error.stack === "string") {
      (ret.stack as unknown as string[]) = error.stack.split(
        FORMAT.LINE_DELIMITER,
      );
    }
    return ret;
  }
  return error;
}
