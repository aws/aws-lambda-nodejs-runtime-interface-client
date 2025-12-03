import { WritableResponseStream } from "./response-stream.js";

const METADATA_PRELUDE_CONTENT_TYPE =
  "application/vnd.awslambda.http-integration-response";
const DELIMITER_LEN = 8;

/**
 * Exposes a helper for Lambda HTTP integrations that need a JSON metadata prelude
 * followed by a fixed‐length null delimiter before streaming the rest of the body.
 */
export class HttpResponseStream {
  /**
   * Wraps the given writable response stream so that on the very first write,
   * it:
   * 1. Sets the Content-Type header to the special integration MIME.
   * 2. Writes a JSON‐stringified prelude.
   * 3. Writes exactly 8 null bytes as a delimiter.
   *
   * @param underlyingStream - your streaming response sink
   * @param prelude - any JSON‐serializable metadata object
   * @returns the same stream, now wired to prepend the metadata
   */
  public static from<T extends Record<string, unknown>>(
    underlyingStream: WritableResponseStream,
    prelude: T,
  ): WritableResponseStream {
    // Override the content‐type
    underlyingStream.setContentType(METADATA_PRELUDE_CONTENT_TYPE);

    // JSON‐stringify the metadata (no nulls allowed in JSON)
    const metadataPrelude = JSON.stringify(prelude);

    // Install a hook to run right before the first actual write
    underlyingStream._onBeforeFirstWrite = (write) => {
      // Write the JSON prelude
      write(metadataPrelude);
      // Then write 8 null bytes
      write(new Uint8Array(DELIMITER_LEN));
    };

    return underlyingStream;
  }
}
