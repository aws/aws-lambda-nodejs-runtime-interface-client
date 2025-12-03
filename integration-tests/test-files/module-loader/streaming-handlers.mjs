/* eslint-disable @typescript-eslint/no-unused-vars */

// 3 args but streaming - should not error
export const handler = async (_event, _responseStream, _context) => {
  // streaming handler logic
};

// Set the streaming symbol to mark this as a streaming handler
handler[Symbol.for("aws.lambda.runtime.handler.streaming")] = "response";
