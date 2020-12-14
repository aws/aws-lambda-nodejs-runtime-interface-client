/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Defines custom error types throwable by the runtime.
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnhandledPromiseRejection = exports.UserCodeSyntaxError = exports.MalformedHandlerName = exports.HandlerNotFound = exports.ImportModuleError = exports.ExtendedError = exports.toFormatted = exports.toRuntimeResponse = exports.isError = void 0;
const util_1 = __importDefault(require("util"));
function isError(obj) {
    return (obj &&
        obj.name &&
        obj.message &&
        obj.stack &&
        typeof obj.name === "string" &&
        typeof obj.message === "string" &&
        typeof obj.stack === "string");
}
exports.isError = isError;
/**
 * Attempt to convert an object into a response object.
 * This method accounts for failures when serializing the error object.
 */
function toRuntimeResponse(error) {
    try {
        if (util_1.default.types.isNativeError(error) || isError(error)) {
            if (!error.stack) {
                throw new Error("Error stack is missing.");
            }
            return {
                errorType: error.name,
                errorMessage: error.message,
                trace: error.stack.split("\n") || [],
            };
        }
        else {
            return {
                errorType: typeof error,
                errorMessage: error.toString(),
                trace: [],
            };
        }
    }
    catch (_err) {
        return {
            errorType: "handled",
            errorMessage: "callback called with Error argument, but there was a problem while retrieving one or more of its message, name, and stack",
            trace: [],
        };
    }
}
exports.toRuntimeResponse = toRuntimeResponse;
/**
 * Format an error with the expected properties.
 * For compatability, the error string always starts with a tab.
 */
exports.toFormatted = (error) => {
    try {
        return ("\t" + JSON.stringify(error, (_k, v) => _withEnumerableProperties(v)));
    }
    catch (err) {
        return "\t" + JSON.stringify(toRuntimeResponse(error));
    }
};
/**
 * Error name, message, code, and stack are all members of the superclass, which
 * means they aren't enumerable and don't normally show up in JSON.stringify.
 * This method ensures those interesting properties are available along with any
 * user-provided enumerable properties.
 */
function _withEnumerableProperties(error) {
    if (error instanceof ExtendedError) {
        const ret = Object.assign({
            errorType: error.name,
            errorMessage: error.message,
            code: error.code,
        }, error);
        if (typeof error.stack == "string") {
            ret.stack = error.stack.split("\n");
        }
        return ret;
    }
    else {
        return error;
    }
}
class ExtendedError extends Error {
    constructor(reason) {
        super(reason); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
}
exports.ExtendedError = ExtendedError;
class ImportModuleError extends ExtendedError {
}
exports.ImportModuleError = ImportModuleError;
class HandlerNotFound extends ExtendedError {
}
exports.HandlerNotFound = HandlerNotFound;
class MalformedHandlerName extends ExtendedError {
}
exports.MalformedHandlerName = MalformedHandlerName;
class UserCodeSyntaxError extends ExtendedError {
}
exports.UserCodeSyntaxError = UserCodeSyntaxError;
class UnhandledPromiseRejection extends ExtendedError {
    constructor(reason, promise) {
        super(reason);
        this.reason = reason;
        this.promise = promise;
    }
}
exports.UnhandledPromiseRejection = UnhandledPromiseRejection;
const errorClasses = [
    ImportModuleError,
    HandlerNotFound,
    MalformedHandlerName,
    UserCodeSyntaxError,
    UnhandledPromiseRejection,
];
errorClasses.forEach((e) => {
    e.prototype.name = `Runtime.${e.name}`;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvRXJyb3JzL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHNFQUFzRTtBQUN0RSx1REFBdUQ7QUFDdkQ7Ozs7R0FJRztBQUVILFlBQVksQ0FBQzs7Ozs7O0FBRWIsZ0RBQXdCO0FBRXhCLFNBQWdCLE9BQU8sQ0FBQyxHQUFRO0lBQzlCLE9BQU8sQ0FDTCxHQUFHO1FBQ0gsR0FBRyxDQUFDLElBQUk7UUFDUixHQUFHLENBQUMsT0FBTztRQUNYLEdBQUcsQ0FBQyxLQUFLO1FBQ1QsT0FBTyxHQUFHLENBQUMsSUFBSSxLQUFLLFFBQVE7UUFDNUIsT0FBTyxHQUFHLENBQUMsT0FBTyxLQUFLLFFBQVE7UUFDL0IsT0FBTyxHQUFHLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FDOUIsQ0FBQztBQUNKLENBQUM7QUFWRCwwQkFVQztBQVFEOzs7R0FHRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLEtBQWM7SUFDOUMsSUFBSTtRQUNGLElBQUksY0FBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3JELElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFO2dCQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7YUFDNUM7WUFDRCxPQUFPO2dCQUNMLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSTtnQkFDckIsWUFBWSxFQUFFLEtBQUssQ0FBQyxPQUFPO2dCQUMzQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTthQUNyQyxDQUFDO1NBQ0g7YUFBTTtZQUNMLE9BQU87Z0JBQ0wsU0FBUyxFQUFFLE9BQU8sS0FBSztnQkFDdkIsWUFBWSxFQUFHLEtBQWEsQ0FBQyxRQUFRLEVBQUU7Z0JBQ3ZDLEtBQUssRUFBRSxFQUFF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