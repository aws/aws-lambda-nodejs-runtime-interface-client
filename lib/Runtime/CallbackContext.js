/* eslint-disable no-console */
/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
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
exports.build = void 0;
const BeforeExitListener_1 = __importDefault(require("./BeforeExitListener"));
const Errors = __importStar(require("../Errors"));
/**
 * Construct the base-context object which includes the required flags and
 * callback methods for the Node programming model.
 *
 * @param client {Client}
 *   The Runtime client used to post results/errors.
 * @param id {string}
 *   The invokeId for the current invocation.
 * @param scheduleNext {function}
 *   A function which takes no params and immediately schedules the next
 *   iteration of the invoke loop.
 * @returns [callback, context]
 *   The same function and context object, but wrapped such that only the
 *   first call to any function will be successful. All subsequent calls are
 *   a no-op.
 */
exports.build = function (client, id, scheduleNext) {
    const [callback, context] = _rawCallbackContext(client, id, scheduleNext);
    return _wrappedCallbackContext(callback, context);
};
function _homogeneousError(err) {
    if (err instanceof Error) {
        return err;
    }
    else {
        return new Error(err);
    }
}
/**
 * Build the callback function and the part of the context which exposes
 * the succeed/fail/done callbacks.
 * @param client {Client}
 *   The Runtime client used to post results/errors.
 * @param id {string}
 *   The invokeId for the current invocation.
 * @param scheduleNext {function}
 *   A function which takes no params and immediately schedules the next
 *   iteration of the invoke loop.
 */
function _rawCallbackContext(client, id, scheduleNext) {
    const postError = (err, callback) => {
        const homogeneousError = _homogeneousError(err);
        console.error("Invoke Error", Errors.toFormatted(homogeneousError));
        client.postInvocationError(err, id, callback);
    };
    const complete = (result, callback) => {
        client.postInvocationResponse(result, id, callback);
    };
    let waitForEmptyEventLoop = true;
    const callback = (err, result) => {
        BeforeExitListener_1.default.reset();
        if (err !== undefined && err !== null) {
            postError(err, scheduleNext);
        }
        else {
            complete(result, () => {
                if (!waitForEmptyEventLoop) {
                    scheduleNext();
                }
                else {
                    BeforeExitListener_1.default.set(scheduleNext);
                }
            });
        }
    };
    const done = (err, result) => {
        BeforeExitListener_1.default.reset();
        if (err !== undefined && err !== null) {
            postError(err, scheduleNext);
        }
        else {
            complete(result, scheduleNext);
        }
    };
    const succeed = (result) => {
        done(null, result);
    };
    const fail = (err) => {
        if (err === undefined || err === null) {
            done("handled");
        }
        else {
            done(err);
        }
    };
    const callbackContext = {
        get callbackWaitsForEmptyEventLoop() {
            return waitForEmptyEventLoop;
        },
        set callbackWaitsForEmptyEventLoop(value) {
            waitForEmptyEventLoop = value;
        },
        succeed,
        fail,
        done,
    };
    return [callback, callbackContext];
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
function _wrappedCallbackContext(callback, callbackContext) {
    let finished = false;
    // eslint-disable-next-line @typescript-eslint/ban-types
    const onlyAllowFirstCall = function (toWrap) {
        return function (...args) {
            if (!finished) {
                // eslint-disable-next-line prefer-spread
                toWrap.apply(null, args);
                finished = true;
            }
        };
    };
    callbackContext.succeed = onlyAllowFirstCall(callbackContext.succeed);
    callbackContext.fail = onlyAllowFirstCall(callbackContext.fail);
    callbackContext.done = onlyAllowFirstCall(callbackContext.done);
    return [onlyAllowFirstCall(callback), callbackContext];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2FsbGJhY2tDb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1J1bnRpbWUvQ2FsbGJhY2tDb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLCtCQUErQjtBQUMvQiw4RUFBOEU7QUFFOUUsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRWIsOEVBQXNEO0FBT3RELGtEQUFvQztBQUdwQzs7Ozs7Ozs7Ozs7Ozs7O0dBZUc7QUFDVSxRQUFBLEtBQUssR0FBRyxVQUNuQixNQUFzQixFQUN0QixFQUFVLEVBQ1YsWUFBd0I7SUFFeEIsTUFBTSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzFFLE9BQU8sdUJBQXVCLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQztBQUVGLFNBQVMsaUJBQWlCLENBQUMsR0FBMkI7SUFDcEQsSUFBSSxHQUFHLFlBQVksS0FBSyxFQUFFO1FBQ3hCLE9BQU8sR0FBRyxDQUFDO0tBQ1o7U0FBTTtRQUNMLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDdkI7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQVMsbUJBQW1CLENBQzFCLE1BQXNCLEVBQ3RCLEVBQVUsRUFDVixZQUF3QjtJQUV4QixNQUFNLFNBQVMsR0FBRyxDQUFDLEdBQTJCLEVBQUUsUUFBb0IsRUFBRSxFQUFFO1FBQ3RFLE1BQU0sZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFDcEUsTUFBTSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsUUFB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