/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the InvokeContext and supporting functions. The
 * InvokeContext is responsible for pulling information from the invoke headers
 * and for wrapping the Rapid Client object's error and response functions.
 */

'use strict';

const assert = require('assert').strict;
let { setCurrentRequestId } = require('./LogPatch');

const INVOKE_HEADER = {
  ClientContext: 'lambda-runtime-client-context',
  CognitoIdentity: 'lambda-runtime-cognito-identity',
  ARN: 'lambda-runtime-invoked-function-arn',
  AWSRequestId: 'lambda-runtime-aws-request-id',
  DeadlineMs: 'lambda-runtime-deadline-ms',
  XRayTrace: 'lambda-runtime-trace-id',
  TenantId: 'lambda-runtime-aws-tenant-id',
};

module.exports = class InvokeContext {
  constructor(headers) {
    this.headers = _enforceLowercaseKeys(headers);
  }

  /**
   * The invokeId for this request.
   */
  get invokeId() {
    let id = this.headers[INVOKE_HEADER.AWSRequestId];
    assert.ok(id, 'invocation id is missing or invalid');
    return id;
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
    return Object.assign(
      callbackContext,
      this._environmentalData(),
      this._headerData(),
    );
  }

  /**
   * All parts of the user-facing context object which are provided through
   * environment variables.
   */
  _environmentalData() {
    return {
      functionVersion: process.env['AWS_LAMBDA_FUNCTION_VERSION'],
      functionName: process.env['AWS_LAMBDA_FUNCTION_NAME'],
      memoryLimitInMB: process.env['AWS_LAMBDA_FUNCTION_MEMORY_SIZE'],
      logGroupName: process.env['AWS_LAMBDA_LOG_GROUP_NAME'],
      logStreamName: process.env['AWS_LAMBDA_LOG_STREAM_NAME'],
    };
  }

  /**
   * All parts of the user-facing context object which are provided through
   * request headers.
   */
  _headerData() {
    const deadline = this.headers[INVOKE_HEADER.DeadlineMs];
    return {
      clientContext: _parseJson(
        this.headers[INVOKE_HEADER.ClientContext],
        'ClientContext',
      ),
      identity: _parseJson(
        this.headers[INVOKE_HEADER.CognitoIdentity],
        'CognitoIdentity',
      ),
      invokedFunctionArn: this.headers[INVOKE_HEADER.ARN],
      awsRequestId: this.headers[INVOKE_HEADER.AWSRequestId],
      tenantId: this.headers[INVOKE_HEADER.TenantId],
      getRemainingTimeInMillis: function () {
        return deadline - Date.now();
      },
    };
  }

  /**
   * Forward the XRay header into the environment variable.
   */
  _forwardXRay() {
    if (this.headers[INVOKE_HEADER.XRayTrace]) {
      process.env['_X_AMZN_TRACE_ID'] = this.headers[INVOKE_HEADER.XRayTrace];
    } else {
      delete process.env['_X_AMZN_TRACE_ID'];
    }
  }
};

/**
 * Parse a JSON string and throw a readable error if something fails.
 * @param jsonString {string} - the string to attempt to parse
 * @param name {name} - the name to use when describing the string in an error
 * @return object - the parsed object
 * @throws if jsonString cannot be parsed
 */
function _parseJson(jsonString, name) {
  if (jsonString !== undefined) {
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      throw new Error(`Cannot parse ${name} as json: ${err.toString()}`);
    }
  } else {
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
