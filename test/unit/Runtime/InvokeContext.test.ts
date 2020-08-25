/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

require("should");
import utilModule from "util";

const sleep = utilModule.promisify(setTimeout);

import InvokeContext from "../../../src/Runtime/InvokeContext";

describe("Getting remaining invoke time", () => {
  it("should reduce by at least elapsed time", async () => {
    const ctx = new InvokeContext({
      "lambda-runtime-deadline-ms": (Date.now() + 1000).toString(),
    });

    const timeout = 100 * 1.05; // 5% margin of error
    const before = ctx.headerData.getRemainingTimeInMillis();
    await sleep(timeout);
    const after = ctx.headerData.getRemainingTimeInMillis();
    (before - after).should.greaterThanOrEqual(100);
  });

  it("should return NaN when the deadline is not defined?", async () => {
    const ctx = new InvokeContext({});
    const remaining = ctx.headerData.getRemainingTimeInMillis();

    remaining.should.be.NaN();
  });

  it("should be within range.", () => {
    const ctx = new InvokeContext({
      "lambda-runtime-deadline-ms": (Date.now() + 1000).toString(),
    });

    const remainingTime = ctx.headerData.getRemainingTimeInMillis();

    remainingTime.should.greaterThan(0);
    remainingTime.should.lessThanOrEqual(1000);
  });
});
