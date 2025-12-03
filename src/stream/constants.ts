export const METADATA_PRELUDE_CONTENT_TYPE =
  "application/vnd.awslambda.http-integration-response";
export const DELIMITER_LEN = 8;

export const HEADER_RESPONSE_MODE = "Lambda-Runtime-Function-Response-Mode";
export const VALUE_STREAMING = "streaming";
export const TRAILER_NAME_ERROR_TYPE = "Lambda-Runtime-Function-Error-Type";
export const TRAILER_NAME_ERROR_BODY = "Lambda-Runtime-Function-Error-Body";

export const HEADER_CONTENT_TYPE = "Content-Type";
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const HEADER_TRANSFER_ENCODING = "Transfer-Encoding";
export const CHUNKED_TRANSFER_ENCODING = "chunked";

export const STATUS_READY = "ready";
export const STATUS_WRITE_CALLED = "write_called";
