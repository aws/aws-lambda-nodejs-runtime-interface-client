/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the top-level Runtime class which controls the
 * bootstrap's execution flow.
 */
import { HandlerFunction, IErrorCallbacks } from "../Common";
import { IRuntimeClient } from "../RuntimeClient";
export default class Runtime {
    client: IRuntimeClient;
    errorCallbacks: IErrorCallbacks;
    handler: HandlerFunction;
    constructor(client: IRuntimeClient, handler: HandlerFunction, errorCallbacks: IErrorCallbacks);
    /**
     * Schedule the next loop iteration to start at the beginning of the next time
     * around the event loop.
     */
    scheduleIteration(): void;
    /**
     * Wait for the next invocation, process it, and schedule the next iteration.
     */
    handleOnce(): Promise<void>;
    /**
     * Replace the error handler callbacks.
     * @param {String} invokeId
     */
    private _setErrorCallbacks;
    /**
     * Setup the 'beforeExit' listener that is used if the callback is never
     * called and the handler is not async.
     * CallbackContext replaces the listener if a callback is invoked.
     */
    private _setDefaultExitListener;
}
//# sourceMappingURL=Runtime.d.ts.map