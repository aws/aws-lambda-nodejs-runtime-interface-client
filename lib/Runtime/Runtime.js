/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the top-level Runtime class which controls the
 * bootstrap's execution flow.
 */
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BeforeExitListener_1 = __importDefault(require("./BeforeExitListener"));
const CallbackContext = __importStar(require("./CallbackContext"));
const InvokeContext_1 = __importDefault(require("./InvokeContext"));
class Runtime {
    constructor(client, handler, errorCallbacks) {
        this.client = client;
        this.handler = handler;
        this.errorCallbacks = errorCallbacks;
    }
    /**
     * Schedule the next loop iteration to start at the beginning of the next time
     * around the event loop.
     */
    scheduleIteration() {
        setImmediate(() => {
            this.handleOnce().then(
            // Success is a no-op at this level. There are 2 cases:
            // 1 - The user used one of the callback functions which already
            //     schedules the next iteration.
            // 2 - The next iteration is not scheduled because the
            //     waitForEmptyEventLoop was set. In this case the beforeExit
            //     handler will automatically start the next iteration.
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            () => { }, 
            // Errors should not reach this level in typical execution. If they do
            // it's a sign of an issue in the Client or a bug in the runtime. So
            // dump it to the console and attempt to report it as a Runtime error.
            (err) => {
                // eslint-disable-next-line no-console
                console.log(`Unexpected Top Level Error: ${err.toString()}`);
                this.errorCallbacks.uncaughtException(err);
            });
        });
    }
    /**
     * Wait for the next invocation, process it, and schedule the next iteration.
     */
    async handleOnce() {
        const { bodyJson, headers } = await this.client.nextInvocation();
        const invokeContext = new InvokeContext_1.default(headers);
        invokeContext.updateLoggingContext();
        const [callback, callbackContext] = CallbackContext.build(this.client, invokeContext.invokeId, this.scheduleIteration.bind(this));
        try {
            this._setErrorCallbacks(invokeContext.invokeId);
            this._setDefaultExitListener(invokeContext.invokeId);
            const result = this.handler(JSON.parse(bodyJson), invokeContext.attachEnvironmentData(callbackContext), callback);
            if (_isPromise(result)) {
                result
                    .then(callbackContext.succeed, callbackContext.fail)
                    .catch(callbackContext.fail);
            }
        }
        catch (err) {
            callback(err);
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
    _setDefaultExitListener(invokeId) {
        BeforeExitListener_1.default.set(() => {
            this.client.postInvocationResponse(null, invokeId, () => this.scheduleIteration());
        });
    }
}
exports.default = Runtime;
function _isPromise(obj) {
    return obj instanceof Promise;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUnVudGltZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9SdW50aW1lL1J1bnRpbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFFSCxZQUFZLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUViLDhFQUFzRDtBQUV0RCxtRUFBcUQ7QUFDckQsb0VBQTRDO0FBRzVDLE1BQXFCLE9BQU87SUFLMUIsWUFDRSxNQUFzQixFQUN0QixPQUF3QixFQUN4QixjQUErQjtRQUUvQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsaUJBQWlCO1FBQ2YsWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUNoQixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsSUFBSTtZQUNwQix1REFBdUQ7WUFDdkQsZ0VBQWdFO1lBQ2hFLG9DQUFvQztZQUNwQyxzREFBc0Q7WUFDdEQsaUVBQWlFO1lBQ2pFLDJEQUEyRDtZQUMzRCxnRUFBZ0U7WUFDaEUsR0FBRyxFQUFFLEdBQUUsQ0FBQztZQUVSLHNFQUFzRTtZQUN0RSxvRUFBb0U7WUFDcEUsc0VBQXNFO1lBQ3RFLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ04sc0NBQXNDO2dCQUN0QyxPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzdDLENBQUMsQ0FDRixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVTtRQUNkLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFF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