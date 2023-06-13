/**
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const BeforeExitListener = require('./BeforeExitListener.js');
const {
  InvalidStreamingOperation,
  toFormatted,
  intoError,
} = require('./Errors');
const { verbose, vverbose } = require('./VerboseLog.js').logger('STREAM');
const { tryCallFail } = require('./ResponseStream');

/**
 * Construct the base-context object which includes the required flags and
 * callback methods for the Node programming model.
 * @param client {RAPIDClient}
 *   The RAPID client used to post results/errors.
 * @param id {string}
 *   The invokeId for the current invocation.
 * @param scheduleNext {function}
 *   A function which takes no params and immediately schedules the next
 *   iteration of the invoke loop.
 * @param options {object}
 *   An object with optional properties for streaming.
 * @return {context}
 *   Context object that has the createStream function.
 */
module.exports.build = function (client, id, scheduleNext, options) {
  let waitForEmptyEventLoop = true;

  const scheduleNextNow = () => {
    verbose('StreamingContext::scheduleNextNow entered');
    if (!waitForEmptyEventLoop) {
      scheduleNext();
    } else {
      BeforeExitListener.set(() => {
        setImmediate(() => {
          scheduleNext();
        });
      });
    }
  };

  let isStreamCreated = false;
  const streamingContext = {
    get callbackWaitsForEmptyEventLoop() {
      return waitForEmptyEventLoop;
    },
    set callbackWaitsForEmptyEventLoop(value) {
      waitForEmptyEventLoop = value;
    },
    createStream: (callback) => {
      if (isStreamCreated) {
        throw new InvalidStreamingOperation(
          'Cannot create stream for the same StreamingContext more than once.',
        );
      }

      const { request: responseStream, responseDone: rapidResponse } =
        client.getStreamForInvocationResponse(id, callback, options);

      isStreamCreated = true;
      vverbose('StreamingContext::createStream stream created');

      return {
        fail: (err, callback) => {
          console.error('Invoke Error', toFormatted(intoError(err)));

          tryCallFail(responseStream, err, callback);
        },
        responseStream,
        rapidResponse,
        scheduleNext: () => {
          verbose('StreamingContext::createStream scheduleNext');
          BeforeExitListener.reset();
          scheduleNextNow();
        },
      };
    },
  };

  return streamingContext;
};
