/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
import { ICallbackContext, CallbackFunction } from "../Common";
import { IRuntimeClient } from "../RuntimeClient";
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
export declare const build: (client: IRuntimeClient, id: string, scheduleNext: () => void) => [CallbackFunction, ICallbackContext];
//# sourceMappingURL=CallbackContext.d.ts.map