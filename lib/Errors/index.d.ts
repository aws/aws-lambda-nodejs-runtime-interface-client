/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Defines custom error types throwable by the runtime.
 */
export declare function isError(obj: any): obj is Error;
interface RuntimeErrorResponse {
    errorType: string;
    errorMessage: string;
    trace: string[];
}
/**
 * Attempt to convert an object into a response object.
 * This method accounts for failures when serializing the error object.
 */
export declare function toRuntimeResponse(error: unknown): RuntimeErrorResponse;
/**
 * Format an error with the expected properties.
 * For compatability, the error string always starts with a tab.
 */
export declare const toFormatted: (error: unknown) => string;
export declare class ExtendedError extends Error {
    code?: number;
    custom?: string;
    reason?: string;
    promise?: Promise<any>;
    constructor(reason?: string);
}
export declare class ImportModuleError extends ExtendedError {
}
export declare class HandlerNotFound extends ExtendedError {
}
export declare class MalformedHandlerName extends ExtendedError {
}
export declare class UserCodeSyntaxError extends ExtendedError {
}
export declare class UnhandledPromiseRejection extends ExtendedError {
    constructor(reason?: string, promise?: Promise<any>);
}
export {};
//# sourceMappingURL=index.d.ts.map