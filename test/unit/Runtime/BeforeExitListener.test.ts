/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

require("should");

describe("Invoke the BeforeExitListener", () => {
  it("should not fail if a listerner has not been set", async () => {
    const beforeExitListenerModule = await import(
      "../../../src/Runtime/BeforeExitListener"
    );
    const beforeExitListener = beforeExitListenerModule.default;

    beforeExitListener.invoke();
  });

  it("should use the listener", async () => {
    let count = 0;
    const listener = () => {
      count++;
    };

    const beforeExitListenerModule = await import(
      "../../../src/Runtime/BeforeExitListener"
    );
    const beforeExitListener = beforeExitListenerModule.default;

    beforeExitListener.set(listener);

    beforeExitListener.invoke();
    count.should.be.equal(1);

    beforeExitListener.invoke();
    count.should.be.equal(2);
  });

  it("should use the same listener even when imported again", async () => {
    let count = 0;
    const listener = () => {
      count++;
    };

    const beforeExitListenerModule = await import(
      "../../../src/Runtime/BeforeExitListener"
    );
    const beforeExitListener = beforeExitListenerModule.default;

    beforeExitListener.set(listener);
    beforeExitListener.invoke();

    const secondImport = await import(
      "../../../src/Runtime/BeforeExitListener"
    );
    const secondBeforeExitListener = secondImport.default;

    secondBeforeExitListener.invoke();
    count.should.be.equal(2);
  });
});
