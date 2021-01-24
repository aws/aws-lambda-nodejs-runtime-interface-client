/**
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines types, enums and interfaces common to the other modules.
 */

import { IncomingHttpHeaders } from "http";

export interface InvocationResponse {
  bodyJson: string;
  headers: IncomingHttpHeaders;
}

export enum INVOKE_HEADER {
  ClientContext = "lambda-runtime-client-context",
  CognitoIdentity = "lambda-runtime-cognito-identity",
  ARN = "lambda-runtime-invoked-function-arn",
  AWSRequestId = "lambda-runtime-aws-request-id",
  DeadlineMs = "lambda-runtime-deadline-ms",
  XRayTrace = "lambda-runtime-trace-id",
}

export interface IEnvironmentData {
  functionVersion?: string;
  functionName?: string;
  memoryLimitInMB?: string;
  logGroupName?: string;
  logStreamName?: string;
}

export interface IHeaderData {
  clientContext?: string;
  identity?: string;
  invokedFunctionArn?: string;
  awsRequestId?: string;
  getRemainingTimeInMillis: () => number;
}

export type ErrorStringOrUndefined = Error | string | undefined;

export type ErrorStringOrUndefinedOrNull = ErrorStringOrUndefined | null;

/**
 *
 */
export interface ICallbackContext {
  callbackWaitsForEmptyEventLoop: boolean;
  succeed: (result: unknown) => void;
  fail: (err: ErrorStringOrUndefinedOrNull) => void;
  done: (err: ErrorStringOrUndefinedOrNull, result?: unknown) => void;
}

export type CallbackFunction = (
  err: ErrorStringOrUndefinedOrNull,
  result?: unknown
) => void;

export interface IBeforeExitListener {
  invoke: () => void;
  reset: () => () => void;
  set: (listener: () => void) => () => void;
}

export interface IErrorCallbacks {
  uncaughtException: (err: Error) => void;
  unhandledRejection: (err: Error) => void;
}

export type HandlerFunction = (
  body: unknown,
  data: IEnvironmentData & IHeaderData,
  callback: CallbackFunction
) => PromiseLike<unknown> | unknown;
