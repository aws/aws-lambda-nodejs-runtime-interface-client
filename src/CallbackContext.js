/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const BeforeExitListener = require('./BeforeExitListener.js');
const { toFormatted, intoError } = require('./Errors');

/**
 * Build the callback function and the part of the context which exposes
 * the succeed/fail/done callbacks.
 * @param client {RuntimeClient}
 *   The RAPID client used to post results/errors.
 * @param id {string}
 *   The invokeId for the current invocation.
 * @param scheduleNext {function}
 *   A function which takes no params and immediately schedules the next
 *   iteration of the invoke loop.
 */
function _rawCallbackContext(client, id, scheduleNext) {
  const postError = (err, callback) => {
    console.error('Invoke Error', toFormatted(intoError(err)));
    client.postInvocationError(err, id, callback);
  };

  let isCompleteInvoked = false;
  const complete = (result, callback) => {
    if (isCompleteInvoked) {
      console.error(
        'Invocation has already been reported as done. Cannot call complete more than once per invocation.',
      );
      return;
    }
    isCompleteInvoked = true;
    client.postInvocationResponse(result, id, callback);
  };

  let waitForEmptyEventLoop = true;

  const callback = function (err, result) {
    BeforeExitListener.reset();
    if (err !== undefined && err !== null) {
      postError(err, scheduleNext);
    } else {
      if (!waitForEmptyEventLoop) {
        complete(result, scheduleNext);
      } else {
        BeforeExitListener.set(() => {
          setImmediate(() => {
            complete(result, scheduleNext);
          });
        });
      }
    }
  };

  const done = (err, result) => {
    BeforeExitListener.reset();
    if (err !== undefined && err !== null) {
      postError(err, scheduleNext);
    } else {
      complete(result, scheduleNext);
    }
  };
  const succeed = (result) => {
    done(null, result);
  };
  const fail = (err) => {
    if (err === undefined || err === null) {
      done('handled');
    } else {
      done(err, null);
    }
  };

  const callbackContext = {
    get callbackWaitsForEmptyEventLoop() {
      return waitForEmptyEventLoop;
    },
    set callbackWaitsForEmptyEventLoop(value) {
      waitForEmptyEventLoop = value;
    },
    succeed: succeed,
    fail: fail,
    done: done,
  };

  return [
    callback,
    callbackContext,
    function () {
      isCompleteInvoked = true;
    },
  ];
}

/**
 * Wraps the callback and context so that only the first call to any callback
 * succeeds.
 * @param callback {function}
 *   the node-style callback function that was previously generated but not
 *   yet wrapped.
 * @param callbackContext {object}
 *   The previously generated callbackContext object that contains
 *   getter/setters for the contextWaitsForEmptyeventLoop flag and the
 *   succeed/fail/done functions.
 * @return [callback, context]
 */
function _wrappedCallbackContext(callback, callbackContext, markCompleted) {
  let finished = false;
  const onlyAllowFirstCall = function (toWrap) {
    return function () {
      if (!finished) {
        toWrap.apply(null, arguments);
        finished = true;
      }
    };
  };

  callbackContext.succeed = onlyAllowFirstCall(callbackContext.succeed);
  callbackContext.fail = onlyAllowFirstCall(callbackContext.fail);
  callbackContext.done = onlyAllowFirstCall(callbackContext.done);

  return [onlyAllowFirstCall(callback), callbackContext, markCompleted];
}

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
 * @return [callback, context]
 *   The same function and context object, but wrapped such that only the
 *   first call to any function will be successful. All subsequent calls are
 *   a no-op.
 */
module.exports.build = function (client, id, scheduleNext) {
  let rawCallbackContext = _rawCallbackContext(client, id, scheduleNext);
  return _wrappedCallbackContext(...rawCallbackContext);
};
