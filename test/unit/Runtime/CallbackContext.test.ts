/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

import { IncomingHttpHeaders } from "http";
import BeforeExitListener from "../../../src/Runtime/BeforeExitListener";
import { IRuntimeClient } from "../../../src/RuntimeClient";
import {
  InvocationResponse,
  CallbackFunction,
  ICallbackContext,
} from "../../../src/Common";
import { build as buildCallBackContext } from "../../../src/Runtime/CallbackContext";

require("should");

class RuntimeClientStub implements IRuntimeClient {
  lastId?: string;
  lastError?: any;
  lastResponse?: string;

  nextInvocation(): Promise<InvocationResponse> {
    return Promise.resolve({
      bodyJson: "{ 'this': 'is a test' }",
      headers: {} as IncomingHttpHeaders,
    });
  }
  postInvocationError(error: unknown, id: string, callback: () => void): void {
    this.lastId = id;
    this.lastError = error;
    callback();
  }

  postInvocationResponse(
    response: unknown,
    id: string,
    callback: () => void
  ): void {
    this.lastId = id;
    this.lastResponse = JSON.stringify(response);
    callback();
  }
}

describe("Executing the callback", () => {
  let scheduledNextCalled = false;
  const scheduleNext = () => {
    scheduledNextCalled = true;
  };

  const dummyExecutionId = "some id";
  let callback: CallbackFunction;
  let context: ICallbackContext;
  let client: RuntimeClientStub;

  beforeEach(() => {
    scheduledNextCalled = false;
    client = new RuntimeClientStub();
    [callback, context] = buildCallBackContext(
      client,
      dummyExecutionId,
      scheduleNext
    );
  });

  it("should call the client with the correct response.", async () => {
    callback(null, "response");

    scheduledNextCalled.should.be.false();
    client.lastResponse?.should.equal('"response"');
    client.lastId?.should.equal(dummyExecutionId);
    client.lastError?.should.be.null();

    BeforeExitListener.invoke();
    scheduledNextCalled.should.be.true();
  });

  it("should not allow the callback to be executed more than once.", async () => {
    callback(null, "response");
    callback(null, "Second time");

    client.lastResponse?.should.equal('"response"');
  });

  it("should immediatelly schedule the next invocation when setting the callbackWaitsForEmptyEventLoop to false.", async () => {
    context.callbackWaitsForEmptyEventLoop = false;
    callback(null, "response when not waiting");

    client.lastResponse?.should.equal('"response when not waiting"');
    scheduledNextCalled.should.be.true();
  });

  it("should call the client with correct error when the error is defined.", () => {
    const myError = new Error("This is an error");

    callback(myError);

    client.lastResponse?.should.be.null();
    client.lastError?.should.equal(myError);
  });

  it("should not wrap an error string into a generic Error.", () => {
    callback("This is an error");

    client.lastResponse?.should.be.null();
    client.lastError?.should.equal("This is an error");
  });
});
