/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

import should from "should";
import LogPatch from "../../../src/utils/LogPatch";
import * as Errors from "../../../src/Errors";

import { captureStream, consoleSnapshot } from "./LoggingGlobals";
import FakeTelemetryTarget from "./FakeTelemetryTarget";

describe("Apply the default console log patch", () => {
  const restoreConsole = consoleSnapshot();
  const capturedStdout = captureStream(process.stdout);

  beforeEach("capture stdout", () => capturedStdout.hook());
  beforeEach("apply console patch", () => LogPatch.patchConsole());
  afterEach("remove console patch", () => restoreConsole());
  afterEach("unhook stdout", () => capturedStdout.unhook());

  it("should have four tab-separated fields on a normal line", () => {
    console.log("anything");
    capturedStdout.captured().should.match(/.*\t.*\t.*\t.*\n/);
  });

  it("should have five tab-separated fields when logging an error", () => {
    console.error("message", Errors.toFormatted(new Error("garbage")));
    capturedStdout.captured().should.match(/.*\t.*\t.*\t.*\t.*\n/);
  });

  describe("When the global requestId is set", () => {
    const EXPECTED_ID = "some fake request id";

    beforeEach("set the request id", () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });
    afterEach("unset the request id", () => {
      LogPatch.setCurrentRequestId(undefined);
    });

    it("should include the requestId as the second field", () => {
      console.info("something");
      capturedStdout
        .captured()
        .should.match(new RegExp(`.*\t${EXPECTED_ID}\t.*\t.*\n`));
    });
  });

  it("should include the level field as the third field", () => {
    console.warn("content");
    capturedStdout.captured().should.match(new RegExp(`.*\t.*\tWARN\t.*\n`));
  });

  it("should include the message as the fourth field", () => {
    const message = "my turbo message";
    console.trace(message);
    capturedStdout
      .captured()
      .should.match(new RegExp(`.*\t.*\t.*\t${message}\n`));
  });

  describe("Each console.* method should include a level value", () => {
    it("should use INFO for console.log", () => {
      console.log("hello");
      capturedStdout.captured().should.containEql("INFO");
    });

    it("should use INFO for console.info", () => {
      console.info("hello");
      capturedStdout.captured().should.containEql("INFO");
    });

    it("should use WARN for console.warn", () => {
      console.warn("hello");
      capturedStdout.captured().should.containEql("WARN");
    });

    it("should use ERROR for console.error", () => {
      console.error("hello");
      capturedStdout.captured().should.containEql("ERROR");
    });

    it("should use TRACE for console.trace", () => {
      console.trace("hello");
      capturedStdout.captured().should.containEql("TRACE");
    });

    it("should use FATAL for console.fatal", () => {
      (console as any).fatal("hello");
      capturedStdout.captured().should.containEql("FATAL");
    });
  });

  it("should log an error as json", () => {
    const expected = new Errors.ExtendedError("some error");
    expected.code = 1234;
    expected.custom = "my custom field";

    console.error("message", Errors.toFormatted(expected));

    const errorString = capturedStdout.captured().split("\t")[4];
    const recoveredError = JSON.parse(errorString);

    recoveredError.should.have.property("errorType", expected.name);
    recoveredError.should.have.property("errorMessage", expected.message);
    recoveredError.should.have.property("stack", expected.stack?.split("\n"));
    recoveredError.should.have.property("code", expected.code);
    recoveredError.should.have.property("custom", expected.custom);
  });
});

describe("The multiline log patch", () => {
  const restoreConsole = consoleSnapshot();
  const telemetryTarget = new FakeTelemetryTarget();

  beforeEach("create a new telemetry file and patch the console", () => {
    telemetryTarget.openFile();
    telemetryTarget.updateEnv();
    LogPatch.patchConsole();
  });
  afterEach("close the telemetry file and unpatch the console", () => {
    restoreConsole();
    telemetryTarget.closeFile();
  });

  it("should clear the telemetry env var", () => {
    should.not.exist(process.env["_LAMBDA_TELEMETRY_LOG_FD"]);
  });

  it("should write a line", () => {
    console.log("a line");
    telemetryTarget.readLine().should.containEql("a line");
  });

  it("should have four tab-separated fields on a normal line", () => {
    console.log("anything");
    telemetryTarget.readLine().should.match(/.*\t.*\t.*\t.*/);
  });

  it("should end with a newline", () => {
    console.log("lol");
    telemetryTarget.readLine().should.match(/.*\n$/);
  });

  it("should have five tab-separated fields when logging an error", () => {
    console.error("message", Errors.toFormatted(new Error("garbage")));
    telemetryTarget.readLine().should.match(/.*\t.*\t.*\t.*\t.*/);
  });

  describe("When the global requestId is set", () => {
    const EXPECTED_ID = "some fake request id";

    beforeEach("set the request id", () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });
    afterEach("unset the request id", () => {
      LogPatch.setCurrentRequestId(EXPECTED_ID);
    });

    it("should include the requestId as the second field", () => {
      console.info("something");
      telemetryTarget
        .readLine()
        .should.match(new RegExp(`.*\t${EXPECTED_ID}\t.*\t.*`));
    });
  });

  it("should include the level field as the third field", () => {
    console.warn("content");
    telemetryTarget.readLine().should.match(new RegExp(`.*\t.*\tWARN\t.*`));
  });

  it("should include the message as the fourth field", () => {
    const message = "my turbo message";
    console.trace(message);
    telemetryTarget
      .readLine()
      .should.match(new RegExp(`.*\t.*\t.*\t${message}`));
  });

  describe("Each console.* method should include a level value", () => {
    it("should use INFO for console.log", () => {
      console.log("hello");
      telemetryTarget.readLine().should.containEql("INFO");
    });

    it("should use INFO for console.info", () => {
      console.info("hello");
      telemetryTarget.readLine().should.containEql("INFO");
    });

    it("should use WARN for console.warn", () => {
      console.warn("hello");
      telemetryTarget.readLine().should.containEql("WARN");
    });

    it("should use ERROR for console.error", () => {
      console.error("hello");
      telemetryTarget.readLine().should.containEql("ERROR");
    });

    it("should use TRACE for console.trace", () => {
      console.trace("hello");
      telemetryTarget.readLine().should.containEql("TRACE");
    });

    it("should use FATAL for console.fatal", () => {
      (console as any).fatal("hello");
      telemetryTarget.readLine().should.containEql("FATAL");
    });
  });

  it("should log an error as json", () => {
    const expected = new Errors.ExtendedError("some error");
    expected.code = 1234;
    expected.custom = "my custom field";

    console.error("message", Errors.toFormatted(expected));

    const errorString = telemetryTarget.readLine().split("\t")[4];
    const recoveredError = JSON.parse(errorString);

    recoveredError.should.have.property("errorType", expected.name);
    recoveredError.should.have.property("errorMessage", expected.message);
    recoveredError.should.have.property("stack", expected.stack?.split("\n"));
    recoveredError.should.have.property("code", expected.code);
    recoveredError.should.have.property("custom", expected.custom);
  });
});
