/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the InvokeContext and supporting functions. The
 * InvokeContext is responsible for pulling information from the invoke headers
 * and for wrapping the Runtime Client object's error and response functions.
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const Common_1 = require("../Common");
const LogPatch_1 = __importDefault(require("../utils/LogPatch"));
const setCurrentRequestId = LogPatch_1.default.setCurrentRequestId;
class InvokeContext {
    constructor(headers) {
        this.headers = _enforceLowercaseKeys(headers);
    }
    getHeaderValue(key) {
        const headerVal = this.headers[key];
        switch (typeof headerVal) {
            case "undefined":
                return undefined;
            case "string":
                return headerVal;
            default:
                if (headerVal.length == 0) {
                    return undefined;
                }
                return headerVal[0];
        }
    }
    /**
     * The invokeId for this request.
     */
    get invokeId() {
        const id = this.getHeaderValue(Common_1.INVOKE_HEADER.AWSRequestId);
        assert_1.strict.ok(id, "invocation id is missing or invalid");
        return id;
    }
    /**
     * The header data for this request.
     */
    get headerData() {
        return this._headerData();
    }
    /**
     * Push relevant invoke data into the logging context.
     */
    updateLoggingContext() {
        setCurrentRequestId(this.invokeId);
    }
    /**
     * Attach all of the relavant environmental and invocation data to the
     * provided object.
     * This method can throw if the headers are malformed and cannot be parsed.
     * @param callbackContext {Object}
     *   The callbackContext object returned by a call to buildCallbackContext().
     * @return {Object}
     *   The user context object with all required data populated from the headers
     *   and environment variables.
     */
    attachEnvironmentData(callbackContext) {
        this._forwardXRay();
        return Object.assign(callbackContext, this._environmentalData(), this._headerData());
    }
    /**
     * All parts of the user-facing context object which are provided through
     * environment variables.
     */
    _environmentalData() {
        return {
            functionVersion: process.env["AWS_LAMBDA_FUNCTION_VERSION"],
            functionName: process.env["AWS_LAMBDA_FUNCTION_NAME"],
            memoryLimitInMB: process.env["AWS_LAMBDA_FUNCTION_MEMORY_SIZE"],
            logGroupName: process.env["AWS_LAMBDA_LOG_GROUP_NAME"],
            logStreamName: process.env["AWS_LAMBDA_LOG_STREAM_NAME"],
        };
    }
    /**
     * All parts of the user-facing context object which are provided through
     * request headers.
     */
    _headerData() {
        const deadline = parseInt(this.getHeaderValue(Common_1.INVOKE_HEADER.DeadlineMs) || "");
        return {
            clientContext: _parseJson(this.getHeaderValue(Common_1.INVOKE_HEADER.ClientContext), "ClientContext"),
            identity: _parseJson(this.getHeaderValue(Common_1.INVOKE_HEADER.CognitoIdentity), "CognitoIdentity"),
            invokedFunctionArn: this.getHeaderValue(Common_1.INVOKE_HEADER.ARN),
            awsRequestId: this.getHeaderValue(Common_1.INVOKE_HEADER.AWSRequestId),
            getRemainingTimeInMillis: function () {
                return deadline - Date.now();
            },
        };
    }
    /**
     * Forward the XRay header into the environment variable.
     */
    _forwardXRay() {
        if (this.getHeaderValue(Common_1.INVOKE_HEADER.XRayTrace)) {
            process.env["_X_AMZN_TRACE_ID"] = this.getHeaderValue(Common_1.INVOKE_HEADER.XRayTrace);
        }
        else {
            delete process.env["_X_AMZN_TRACE_ID"];
        }
    }
}
exports.default = InvokeContext;
/**
 * Parse a JSON string and throw a readable error if something fails.
 * @param jsonString {string} - the string to attempt to parse
 * @param name {string} - the name to use when describing the string in an error
 * @return object - the parsed object
 * @throws if jsonString cannot be parsed
 */
function _parseJson(jsonString, name) {
    if (jsonString !== undefined) {
        try {
            return JSON.parse(jsonString);
        }
        catch (err) {
            throw new Error(`Cannot parse ${name} as json: ${err.toString()}`);
        }
    }
    else {
        return undefined;
    }
}
/**
 * Construct a copy of an object such that all of its keys are lowercase.
 */
function _enforceLowercaseKeys(original) {
    return Object.keys(original).reduce((enforced, originalKey) => {
        enforced[originalKey.toLowerCase()] = original[originalKey];
        return enforced;
    }, {});
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW52b2tlQ29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9SdW50aW1lL0ludm9rZUNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsWUFBWSxDQUFDOzs7OztBQUViLG1DQUEwQztBQUUxQyxzQ0FLbUI7QUFDbkIsaUVBQXlDO0FBRXpDLE1BQU0sbUJBQW1CLEdBQUcsa0JBQVEsQ0FBQyxtQkFBbUIsQ0FBQztBQUV6RCxNQUFxQixhQUFhO0lBR2hDLFlBQVksT0FBNEI7UUFDdEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU8sY0FBYyxDQUFDLEdBQVc7UUFDaEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVwQyxRQUFRLE9BQU8sU0FBUyxFQUFFO1lBQ3hCLEtBQUssV0FBVztnQkFDZCxPQUFPLFNBQVMsQ0FBQztZQUNuQixLQUFLLFFBQVE7Z0JBQ1gsT0FBTyxTQUFTLENBQUM7WUFDbkI7Z0JBQ0UsSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtvQkFDekIsT0FBTyxTQUFTLENBQUM7aUJBQ2xCO2dCQUVELE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3ZCO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxRQUFRO1FBQ1YsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxzQkFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzNELGVBQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLHFDQUFxQyxDQUFDLENBQUM7UUFDckQsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLFVBQVU7UUFDWixPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1QixDQUFDO0lBRUQ7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