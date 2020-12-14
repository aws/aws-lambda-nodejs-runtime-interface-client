/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
import { IBeforeExitListener } from "../Common";
declare class BeforeExitListener implements IBeforeExitListener {
    constructor();
    /**
     * Call the listener function with no arguments.
     */
    invoke: () => void;
    /**
     * Reset the listener to a no-op function.
     */
    reset: () => (() => void);
    /**
     * Set the listener to the provided function.
     */
    set: (listener: () => void) => (() => void);
}
declare const beforeExitListener: BeforeExitListener;
export default beforeExitListener;
//# sourceMappingURL=BeforeExitListener.d.ts.map