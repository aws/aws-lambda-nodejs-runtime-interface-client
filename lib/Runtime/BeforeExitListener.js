/* eslint-disable @typescript-eslint/no-explicit-any */
/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
class BeforeExitListener {
    constructor() {
        /**
         * Call the listener function with no arguments.
         */
        this.invoke = () => global[LISTENER_SYMBOL]();
        /**
         * Reset the listener to a no-op function.
         */
        this.reset = () => (global[LISTENER_SYMBOL] = NO_OP_LISTENER);
        /**
         * Set the listener to the provided function.
         */
        this.set = (listener) => (global[LISTENER_SYMBOL] = listener);
        this.reset();
    }
}
const beforeExitListener = new BeforeExitListener();
exports.default = beforeExitListener;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmVmb3JlRXhpdExpc3RlbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1J1bnRpbWUvQmVmb3JlRXhpdExpc3RlbmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHVEQUF1RDtBQUN2RCw4RUFBOEU7QUFFOUUsWUFBWSxDQUFDOztBQUliOzs7Ozs7R0FNRztBQUVILGlEQUFpRDtBQUNqRCxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUM7QUFFNUQsTUFBTSxjQUFjLEdBQUcsR0FBRyxFQUFFO0lBQzFCLFVBQVU7QUFDWixDQUFDLENBQUM7QUFFRixrQkFBa0I7QUFDbEIsTUFBTSxrQkFBa0I7SUFDdEI7UUFJQTs7V0FFRztRQUNILFdBQU0sR0FBRyxHQUFTLEVBQUUsQ0FBRSxNQUFjLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztRQUV4RDs7V0FFRztRQUNILFVBQUssR0FBRyxHQUFpQixFQUFFLENBQ3pCLENBQUUsTUFBYyxDQUFDLGVBQWUsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDO1FBRXREOztXQUVHO1FBQ0gsUUFBRyxHQUFHLENBQUMsUUFBb0IsRUFBZ0IsRUFBRSxDQUMzQyxDQUFFLE1BQWMsQ0FBQyxlQUFlLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQztRQWxCOUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2YsQ0FBQztDQWtCRjtBQUVELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBRXBELGtCQUFlLGtCQUFrQixDQUFDIn0=