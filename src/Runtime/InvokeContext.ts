/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the InvokeContext and supporting functions. The
 * InvokeContext is responsible for pulling information from the invoke headers
 * and for wrapping the Runtime Client object's error and response functions.
 */

"use strict";

import { strict as assert } from "assert";
import { IncomingHttpHeaders } from "http";
import {
  ICallbackContext,
  IHeaderData,
  IEnvironmentData,
  INVOKE_HEADER,
} from "../Common";
import LogPatch from "../utils/LogPatch";

const setCurrentRequestId = LogPatch.setCurrentRequestId;

export default class InvokeContext {
  headers: IncomingHttpHeaders;

  constructor(headers: IncomingHttpHeaders) {
    this.headers = _enforceLowercaseKeys(headers);
  }

  private getHeaderValue(key: string): string | undefined {
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
  get invokeId(): string {
    const id = this.getHeaderValue(INVOKE_HEADER.AWSRequestId);
    assert.ok(id, "invocation id is missing or invalid");
    return id;
  }

  /**
   * The header data for this request.
   */
  get headerData(): IHeaderData {
    return this._headerData();
  }

  /**
   * Push relevant invoke data into the logging context.
   */
  updateLoggingContext(): void {
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
  attachEnvironmentData(
    callbackContext: ICallbackContext
  ): ICallbackContext & IEnvironmentData & IHeaderData {
    this._forwardXRay();
    return Object.assign(
      callbackContext,
      this._environmentalData(),
      this._headerData()
    );
  }

  /**
   * All parts of the user-facing context object which are provided through
   * environment variables.
   */
  private _environmentalData(): IEnvironmentData {
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
  private _headerData(): IHeaderData {
    const deadline = parseInt(
      this.getHeaderValue(INVOKE_HEADER.DeadlineMs) || ""
    );
    return {
      clientContext: _parseJson(
        this.getHeaderValue(INVOKE_HEADER.ClientContext),
        "ClientContext"
      ),
      identity: _parseJson(
        this.getHeaderValue(INVOKE_HEADER.CognitoIdentity),
        "CognitoIdentity"
      ),
      invokedFunctionArn: this.getHeaderValue(INVOKE_HEADER.ARN),
      awsRequestId: this.getHeaderValue(INVOKE_HEADER.AWSRequestId),
      getRemainingTimeInMillis: function () {
        return deadline - Date.now();
      },
    };
  }

  /**
   * Forward the XRay header into the environment variable.
   */
  private _forwardXRay(): void {
    if (this.getHeaderValue(INVOKE_HEADER.XRayTrace)) {
      process.env["_X_AMZN_TRACE_ID"] = this.getHeaderValue(
        INVOKE_HEADER.XRayTrace
      );
    } else {
      delete process.env["_X_AMZN_TRACE_ID"];
    }
  }
}

/**
 * Parse a JSON string and throw a readable error if something fails.
 * @param jsonString {string} - the string to attempt to parse
 * @param name {string} - the name to use when describing the string in an error
 * @return object - the parsed object
 * @throws if jsonString cannot be parsed
 */
function _parseJson(jsonString?: string, name?: string): string | undefined {
  if (jsonString !== undefined) {
    try {
      return JSON.parse(jsonString);
    } catch (err: any) {
      throw new Error(`Cannot parse ${name} as json: ${err.toString()}`);
    }
  } else {
    return undefined;
  }
}

/**
 * Construct a copy of an object such that all of its keys are lowercase.
 */
function _enforceLowercaseKeys(
  original: IncomingHttpHeaders
): IncomingHttpHeaders {
  return Object.keys(original).reduce((enforced, originalKey) => {
    enforced[originalKey.toLowerCase()] = original[originalKey];
    return enforced;
  }, {} as IncomingHttpHeaders);
}
