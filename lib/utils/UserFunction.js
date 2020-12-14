/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the functions for loading the user's code as specified
 * in a handler string.
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Errors_1 = require("../Errors");
const FUNCTION_EXPR = /^([^.]*)\.(.*)$/;
const RELATIVE_PATH_SUBSTRING = "..";
/**
 * Break the full handler string into two pieces, the module root and the actual
 * handler string.
 * Given './somepath/something/module.nestedobj.handler' this returns
 * ['./somepath/something', 'module.nestedobj.handler']
 */
function _moduleRootAndHandler(fullHandlerString) {
    const handlerString = path_1.default.basename(fullHandlerString);
    const moduleRoot = fullHandlerString.substring(0, fullHandlerString.indexOf(handlerString));
    return [moduleRoot, handlerString];
}
/**
 * Split the handler string into two pieces: the module name and the path to
 * the handler function.
 */
function _splitHandlerString(handler) {
    const match = handler.match(FUNCTION_EXPR);
    if (!match || match.length != 3) {
        throw new Errors_1.MalformedHandlerName("Bad handler");
    }
    return [match[1], match[2]]; // [module, function-path]
}
/**
 * Resolve the user's handler function from the module.
 */
function _resolveHandler(object, nestedProperty) {
    return nestedProperty.split(".").reduce((nested, key) => {
        return nested && nested[key];
    }, object);
}
/**
 * Verify that the provided path can be loaded as a file per:
 * https://nodejs.org/dist/latest-v10.x/docs/api/modules.html#modules_all_together
 * @param string - the fully resolved file path to the module
 * @return bool
 */
function _canLoadAsFile(modulePath) {
    return fs_1.default.existsSync(modulePath) || fs_1.default.existsSync(modulePath + ".js");
}
/**
 * Attempt to load the user's module.
 * Attempts to directly resolve the module relative to the application root,
 * then falls back to the more general require().
 */
function _tryRequire(appRoot, moduleRoot, module) {
    const lambdaStylePath = path_1.default.resolve(appRoot, moduleRoot, module);
    if (_canLoadAsFile(lambdaStylePath)) {
        return require(lambdaStylePath);
    }
    else {
        // Why not just require(module)?
        // Because require() is relative to __dirname, not process.cwd()
        const nodeStylePath = require.resolve(module, {
            paths: [appRoot, moduleRoot],
        });
        return require(nodeStylePath);
    }
}
/**
 * Load the user's application or throw a descriptive error.
 * @throws Runtime errors in two cases
 *   1 - UserCodeSyntaxError if there's a syntax error while loading the module
 *   2 - ImportModuleError if the module cannot be found
 */
function _loadUserApp(appRoot, moduleRoot, module) {
    try {
        return _tryRequire(appRoot, moduleRoot, module);
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            throw new Errors_1.UserCodeSyntaxError(e.message);
        }
        else if (e.code !== undefined && e.code === "MODULE_NOT_FOUND") {
            throw new Errors_1.ImportModuleError(e);
        }
        else {
            throw e;
        }
    }
}
function _throwIfInvalidHandler(fullHandlerString) {
    if (fullHandlerString.includes(RELATIVE_PATH_SUBSTRING)) {
        throw new Errors_1.MalformedHandlerName(`'${fullHandlerString}' is not a valid handler name. Use absolute paths when specifying root directories in handler names.`);
    }
}
/**
 * Load the user's function with the approot and the handler string.
 * @param appRoot {string}
 *   The path to the application root.
 * @param handlerString {string}
 *   The user-provided handler function in the form 'module.function'.
 * @return userFuction {function}
 *   The user's handler function. This function will be passed the event body,
 *   the context object, and the callback function.
 * @throws In five cases:-
 *   1 - if the handler string is incorrectly formatted an error is thrown
 *   2 - if the module referenced by the handler cannot be loaded
 *   3 - if the function in the handler does not exist in the module
 *   4 - if a property with the same name, but isn't a function, exists on the
 *       module
 *   5 - the handler includes illegal character sequences (like relative paths
 *       for traversing up the filesystem '..')
 *   Errors for scenarios known by the runtime, will be wrapped by Runtime.* errors.
 */
exports.load = function (appRoot, fullHandlerString) {
    _throwIfInvalidHandler(fullHandlerString);
    const [moduleRoot, moduleAndHandler] = _moduleRootAndHandler(fullHandlerString);
    const [module, handlerPath] = _splitHandlerString(moduleAndHandler);
    const userApp = _loadUserApp(appRoot, moduleRoot, module);
    const handlerFunc = _resolveHandler(userApp, handlerPath);
    if (!handlerFunc) {
        throw new Errors_1.HandlerNotFound(`${fullHandlerString} is undefined or not exported`);
    }
    if (typeof handlerFunc !== "function") {
        throw new Errors_1.HandlerNotFound(`${fullHandlerString} is not a function`);
    }
    return handlerFunc;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVXNlckZ1bmN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL1VzZXJGdW5jdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1REFBdUQ7QUFDdkQ7Ozs7O0dBS0c7QUFFSCxZQUFZLENBQUM7Ozs7OztBQUViLGdEQUF3QjtBQUN4Qiw0Q0FBb0I7QUFFcEIsc0NBS21CO0FBRW5CLE1BQU0sYUFBYSxHQUFHLGlCQUFpQixDQUFDO0FBQ3hDLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDO0FBRXJDOzs7OztHQUtHO0FBQ0gsU0FBUyxxQkFBcUIsQ0FBQyxpQkFBeUI7SUFDdEQsTUFBTSxhQUFhLEdBQUcsY0FBSSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3ZELE1BQU0sVUFBVSxHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FDNUMsQ0FBQyxFQUNELGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FDekMsQ0FBQztJQUNGLE9BQU8sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMsbUJBQW1CLENBQUMsT0FBZTtJQUMxQyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzNDLElBQUksQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7UUFDL0IsTUFBTSxJQUFJLDZCQUFvQixDQUFDLGFBQWEsQ0FBQyxDQUFDO0tBQy9DO0lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLDBCQUEwQjtBQUN6RCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxNQUFXLEVBQUUsY0FBc0I7SUFDMUQsT0FBTyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcs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