/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

require("should");
import * as XRayError from "../../../src/Errors/XRayError";

describe("Formatted Error Logging", () => {
  it("should fall back to a minimal error format when an exception occurs", () => {
    const error = new Error("custom message");
    error.name = "CircularError";
    error.stack = `CircularError: custom message
                      at exports.handler (/var/function/node_modules/event_invoke.js:3:502)
                      at exports.handler (/var/function/node_modules/event_invoke.js:5:242)
                      at (/var/function/test_exec.js:4:123)`;

    const loggedXRayError = JSON.parse(XRayError.toFormatted(error).trim());
    loggedXRayError.should.have.property("working_directory");
    loggedXRayError.should.have.property("exceptions");
    loggedXRayError.should.have
      .property("paths")
      .with.containDeep([
        "/var/function/node_modules/event_invoke.js",
        "/var/function/test_exec.js",
      ]);

    const exceptions = loggedXRayError.exceptions;

    exceptions.should.have.length(1);

    const loggedError = exceptions[0];

    loggedError.should.have.property("type", "CircularError");
    loggedError.should.have.property("message", "custom message");
    loggedError.should.have.property("stack").containDeep([
      {
        path: "/var/function/node_modules/event_invoke.js",
        line: 3,
        label: "exports.handler",
      },
      {
        path: "/var/function/node_modules/event_invoke.js",
        line: 5,
        label: "exports.handler",
      },
      {
        path: "/var/function/test_exec.js",
        line: 4,
        label: "anonymous",
      },
    ]);
  });
});
