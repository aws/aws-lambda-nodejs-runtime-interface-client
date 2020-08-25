/* eslint-disable @typescript-eslint/no-explicit-any */
/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

import { IBeforeExitListener } from "../Common";

/**
 * The runtime has a single beforeExit function which is stored in the global
 * object with a symbol key.
 * The symbol is not exported.
 * The process.beforeExit listener is setup in index.js along with all other
 * top-level process event listeners.
 */

// define a named symbol for the handler function
const LISTENER_SYMBOL = Symbol.for("aws.lambda.beforeExit");

const NO_OP_LISTENER = () => {
  /* NoOp */
};

// export a setter
class BeforeExitListener implements IBeforeExitListener {
  constructor() {
    this.reset();
  }

  /**
   * Call the listener function with no arguments.
   */
  invoke = (): void => (global as any)[LISTENER_SYMBOL]();

  /**
   * Reset the listener to a no-op function.
   */
  reset = (): (() => void) =>
    ((global as any)[LISTENER_SYMBOL] = NO_OP_LISTENER);

  /**
   * Set the listener to the provided function.
   */
  set = (listener: () => void): (() => void) =>
    ((global as any)[LISTENER_SYMBOL] = listener);
}

const beforeExitListener = new BeforeExitListener();

export default beforeExitListener;
