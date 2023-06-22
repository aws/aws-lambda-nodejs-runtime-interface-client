/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the top-level Runtime class which controls the
 * bootstrap's execution flow.
 */

'use strict';

const InvokeContext = require('./InvokeContext.js');
const CallbackContext = require('./CallbackContext.js');
const StreamingContext = require('./StreamingContext.js');
const BeforeExitListener = require('./BeforeExitListener.js');
const { STREAM_RESPONSE } = require('./UserFunction.js');
const { verbose, vverbose } = require('./VerboseLog.js').logger('RAPID');

module.exports = class Runtime {
  constructor(client, handler, handlerMetadata, errorCallbacks) {
    this.client = client;
    this.handler = handler;
    this.handlerMetadata = handlerMetadata;
    this.errorCallbacks = errorCallbacks;
    this.handleOnce =
      handlerMetadata.streaming === STREAM_RESPONSE
        ? this.handleOnceStreaming
        : this.handleOnceNonStreaming;
  }

  /**
   * Schedule the next loop iteration to start at the beginning of the next time
   * around the event loop.
   */
  scheduleIteration() {
    let that = this;
    setImmediate(() => {
      that.handleOnce().then(
        // Success is a no-op at this level. There are 2 cases:
        // 1 - The user used one of the callback functions which already
        //     schedules the next iteration.
        // 2 - The next iteration is not scheduled because the
        //     waitForEmptyEventLoop was set. In this case the beforeExit
        //     handler will automatically start the next iteration.
        () => {},

        // Errors should not reach this level in typical execution. If they do
        // it's a sign of an issue in the Client or a bug in the runtime. So
        // dump it to the console and attempt to report it as a Runtime error.
        (err) => {
          console.log(`Unexpected Top Level Error: ${err.toString()}`);
          this.errorCallbacks.uncaughtException(err);
        },
      );
    });
  }

  /**
   * Wait for the next invocation, process it, and schedule the next iteration.
   */
  async handleOnceNonStreaming() {
    let { bodyJson, headers } = await this.client.nextInvocation();
    let invokeContext = new InvokeContext(headers);
    invokeContext.updateLoggingContext();

    let [callback, callbackContext, markCompleted] = CallbackContext.build(
      this.client,
      invokeContext.invokeId,
      this.scheduleIteration.bind(this),
    );

    try {
      this._setErrorCallbacks(invokeContext.invokeId);
      this._setDefaultExitListener(invokeContext.invokeId, markCompleted);

      let result = this.handler(
        JSON.parse(bodyJson),
        invokeContext.attachEnvironmentData(callbackContext),
        callback,
      );

      if (_isPromise(result)) {
        result
          .then(callbackContext.succeed, callbackContext.fail)
          .catch(callbackContext.fail);
      }
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Wait for the next invocation, process it, and schedule the next iteration.
   */
  async handleOnceStreaming() {
    let { bodyJson, headers } = await this.client.nextInvocation();

    let invokeContext = new InvokeContext(headers);
    invokeContext.updateLoggingContext();

    let streamingContext = StreamingContext.build(
      this.client,
      invokeContext.invokeId,
      this.scheduleIteration.bind(this),
      this.handlerMetadata?.highWaterMark
        ? { highWaterMark: this.handlerMetadata.highWaterMark }
        : undefined,
    );

    const {
      responseStream,
      rapidResponse,
      scheduleNext,
      fail: ctxFail,
    } = streamingContext.createStream();
    delete streamingContext.createStream;

    try {
      this._setErrorCallbacks(invokeContext.invokeId);
      this._setStreamingExitListener(invokeContext.invokeId, responseStream);

      const ctx = invokeContext.attachEnvironmentData(streamingContext);

      verbose('Runtime::handleOnceStreaming', 'invoking handler');
      const event = JSON.parse(bodyJson);
      const handlerResult = this.handler(event, responseStream, ctx);
      verbose('Runtime::handleOnceStreaming', 'handler returned');

      if (!_isPromise(handlerResult)) {
        verbose('Runtime got non-promise response');
        ctxFail('Streaming does not support non-async handlers.', scheduleNext);

        return;
      }

      const result = await handlerResult;
      if (typeof result !== 'undefined') {
        console.warn('Streaming handlers ignore return values.');
      }
      verbose('Runtime::handleOnceStreaming result is awaited.');

      // await for the rapid response if present.
      if (rapidResponse) {
        const res = await rapidResponse;
        vverbose('RAPID response', res);
      }

      if (!responseStream.writableFinished) {
        ctxFail('Response stream is not finished.', scheduleNext);
        return;
      }

      // Handler returned and response has ended.
      scheduleNext();
    } catch (err) {
      verbose('Runtime::handleOnceStreaming::finally stream destroyed');
      ctxFail(err, scheduleNext);
    }
  }

  /**
   * Replace the error handler callbacks.
   * @param {String} invokeId
   */
  _setErrorCallbacks(invokeId) {
    this.errorCallbacks.uncaughtException = (error) => {
      this.client.postInvocationError(error, invokeId, () => {
        process.exit(129);
      });
    };
    this.errorCallbacks.unhandledRejection = (error) => {
      this.client.postInvocationError(error, invokeId, () => {
        process.exit(128);
      });
    };
  }

  /**
   * Setup the 'beforeExit' listener that is used if the callback is never
   * called and the handler is not async.
   * CallbackContext replaces the listener if a callback is invoked.
   */
  _setDefaultExitListener(invokeId, markCompleted) {
    BeforeExitListener.set(() => {
      markCompleted();
      this.client.postInvocationResponse(null, invokeId, () =>
        this.scheduleIteration(),
      );
    });
  }

  /**
   * Setup the 'beforeExit' listener that is used if the callback is never
   * called and the handler is not async.
   * CallbackContext replaces the listener if a callback is invoked.
   */
  _setStreamingExitListener(_invokeId) {
    BeforeExitListener.set(() => {
      this.scheduleIteration();
    });
  }
};

function _isPromise(obj) {
  return obj && obj.then && typeof obj.then === 'function';
}
