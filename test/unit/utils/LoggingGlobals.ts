/* eslint-disable prefer-rest-params */
/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

/**
 * Testing logging in unit tests requires manipulating the global console and
 * stdout objects.
 * This module provides methods for safely capturing and restoring these
 * objects under test.
 */

export const consoleSnapshot = (): (() => void) => {
  const log = console.log;
  const debug = console.debug;
  const info = console.info;
  const warn = console.warn;
  const error = console.error;
  const trace = console.trace;
  const fatal = (console as any).fatal;

  return function restoreConsole() {
    console.log = log;
    console.debug = debug;
    console.info = info;
    console.warn = warn;
    console.error = error;
    console.trace = trace;
    (console as any).fatal = fatal;
  };
};

interface CapturedStream {
  hook: () => void;
  unhook: () => any;
  captured: () => string;
}

/**
 * Capture all of the writes to a given stream.
 */
export const captureStream = function captureStream(
  stream: NodeJS.WritableStream
): CapturedStream {
  const originalWrite: any = stream.write;
  let buf = "";
  return {
    hook: () => {
      buf = ""; // reset the buffer
      stream.write = function (chunk: any): boolean {
        buf += chunk.toString();
        return originalWrite.apply(stream, arguments);
      };
    },
    unhook: () => (stream.write = originalWrite),
    captured: () => buf,
  };
};
