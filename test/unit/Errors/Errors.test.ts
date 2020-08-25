/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

require("should");
import * as Errors from "../../../src/Errors";

class CircularError extends Error {
  backlink: Error;

  constructor(message?: string) {
    super(message);

    this.backlink = this;
    this.name = "CircularError";
  }
}

describe("Formatting Error Logging", () => {
  it("should fall back to a minimal error format when an exception occurs", () => {
    const error = new CircularError("custom message");
    error.backlink = error;

    const loggedError = JSON.parse(Errors.toFormatted(error).trim());
    loggedError.should.have.property("errorType", "CircularError");
    loggedError.should.have.property("errorMessage", "custom message");
    loggedError.should.have.property("trace");
    loggedError.trace.length.should.be.aboveOrEqual(1);
  });
});

describe("Converting an Error to a Runtime response", () => {
  it("should create a RuntimeErrorResponse object when an Error object is given", () => {
    const error = new Error("custom message");
    error.name = "Runtime.TestError";

    const errorResponse = Errors.toRuntimeResponse(error);

    errorResponse.should.have.property("errorType", "Runtime.TestError");
    errorResponse.should.have.property("errorMessage", "custom message");
    errorResponse.should.have.property("trace");
    errorResponse.trace.length.should.be.aboveOrEqual(1);
  });

  it("should return a handled error response when the trace is missing", () => {
    const error = new Error("custom message");
    error.name = "Runtime.TestError";
    error.stack = undefined;

    const errorResponse = Errors.toRuntimeResponse(error);

    errorResponse.should.have.property("errorType", "handled");
    errorResponse.should.have
      .property("errorMessage")
      .with.match(/message, name, and stack/);
    errorResponse.should.have.property("trace");
    errorResponse.trace.length.should.be.equal(0);
  });

  it("should handle strings by setting them as the message and assigning error type to string", () => {
    const error = "custom message";
    const errorResponse = Errors.toRuntimeResponse(error);

    errorResponse.should.have.property("errorType", "string");
    errorResponse.should.have.property("errorMessage", "custom message");
    errorResponse.should.have.property("trace");
    errorResponse.trace.length.should.be.equal(0);
  });

  it("should handle arbitrary objects by converting them to string", () => {
    const error = {
      text: "custom message",
    };

    const errorResponse = Errors.toRuntimeResponse(error);

    errorResponse.should.have.property("errorType", "object");
    errorResponse.should.have.property("errorMessage", "[object Object]");
    errorResponse.should.have.property("trace");
    errorResponse.trace.length.should.be.equal(0);
  });

  it("should handle arbitrary objects by converting them to string by calling the toString method", () => {
    const error = {
      text: "custom message",
    };
    error.toString = () => error.text;
    const errorResponse = Errors.toRuntimeResponse(error);

    errorResponse.should.have.property("errorType", "object");
    errorResponse.should.have.property("errorMessage", "custom message");
    errorResponse.should.have.property("trace");
    errorResponse.trace.length.should.be.equal(0);
  });
});
