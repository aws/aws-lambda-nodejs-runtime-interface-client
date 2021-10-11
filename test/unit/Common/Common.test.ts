"use strict";

require("should");
import * as Common from "../../../src/Common";

describe("type guards HandlerFunction", () => {
  it("should compile the code", () => {
    const func = () => {};
    if (Common.isHandlerFunction(func)) {
      func();
    }
  });

  it("should return true if function", () => {
    Common.isHandlerFunction(() => {}).should.be.true();
  });

  it("should return false if not function", () => {
    Common.isHandlerFunction("MyHandler").should.be.false();
  });
});
