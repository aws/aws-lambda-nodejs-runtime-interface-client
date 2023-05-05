/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the top-level Runtime class which controls the
 * bootstrap's execution flow.
 */

"use strict";

import BeforeExitListener from "./BeforeExitListener";
import { HandlerFunction, IErrorCallbacks } from "../Common";
import * as CallbackContext from "./CallbackContext";
import InvokeContext from "./InvokeContext";
import { IRuntimeClient } from "../RuntimeClient";

export default class Runtime {
  client: IRuntimeClient;
  errorCallbacks: IErrorCallbacks;
  handler: HandlerFunction;

  constructor(
    client: IRuntimeClient,
    handler: HandlerFunction,
    errorCallbacks: IErrorCallbacks
  ) {
    this.client = client;
    this.handler = handler;
    this.errorCallbacks = errorCallbacks;
  }

  /**
   * Schedule the next loop iteration to start at the beginning of the next time
   * around the event loop.
   */
  scheduleIteration(): void {
    setImmediate(() => {
      this.handleOnce().then(
        // Success is a no-op at this level. There are 2 cases:
        // 1 - The user used one of the callback functions which already
        //     schedules the next iteration.
        // 2 - The next iteration is not scheduled because the
        //     waitForEmptyEventLoop was set. In this case the beforeExit
        //     handler will automatically start the next iteration.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},

        // Errors should not reach this level in typical execution. If they do
        // it's a sign of an issue in the Client or a bug in the runtime. So
        // dump it to the console and attempt to report it as a Runtime error.
        (err) => {
          // eslint-disable-next-line no-console
          console.log(`Unexpected Top Level Error: ${err.toString()}`);
          this.errorCallbacks.uncaughtException(err);
        }
      );
    });
  }

  /**
   * Wait for the next invocation, process it, and schedule the next iteration.
   */
  async handleOnce(): Promise<void> {
    const { bodyJson, headers } = await this.client.nextInvocation();
    const invokeContext = new InvokeContext(headers);
    invokeContext.updateLoggingContext();

    const [callback, callbackContext] = CallbackContext.build(
      this.client,
      invokeContext.invokeId,
      this.scheduleIteration.bind(this)
    );

    try {
      this._setErrorCallbacks(invokeContext.invokeId);
      this._setDefaultExitListener(invokeContext.invokeId);

      const result = this.handler(
        JSON.parse(bodyJson),
        invokeContext.attachEnvironmentData(callbackContext),
        callback
      );

      if (_isPromise(result)) {
        result
          .then(callbackContext.succeed, callbackContext.fail)
          .catch(callbackContext.fail);
      }
    } catch (err: any) {
      callback(err);
    }
  }

  /**
   * Replace the error handler callbacks.
   * @param {String} invokeId
   */
  private _setErrorCallbacks(invokeId: string): void {
    this.errorCallbacks.uncaughtException = (error: Error): void => {
      this.client.postInvocationError(error, invokeId, () => {
        process.exit(129);
      });
    };
    this.errorCallbacks.unhandledRejection = (error: Error): void => {
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
  private _setDefaultExitListener(invokeId: string): void {
    BeforeExitListener.set(() => {
      this.client.postInvocationResponse(null, invokeId, () =>
        this.scheduleIteration()
      );
    });
  }
}

function _isPromise(obj: Promise<unknown> | unknown): obj is Promise<unknown> {
  return obj instanceof Promise;
}
