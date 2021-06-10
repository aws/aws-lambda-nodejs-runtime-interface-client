/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

require("should");
import { load } from "../../../src/utils/UserFunction";

describe("Invoking the load function", async() => {
    it("should resolve promise when init hook function is present", async() => {
        const handler = "InitPresent.handler"
        const appRoot = "test/unit/utils/function";

        const handlerFunc = (await load(
            appRoot,
            handler
        )) as Function;

        handlerFunc.should.be.Function;
        handlerFunc().should.be.true;
    });
    it("should not fail when init hook function is absent", async() => {
        const handler = "InitAbsent.handler"
        const appRoot = "test/unit/utils/function";

        const handlerFunc = (await load(
            appRoot,
            handler
        )) as Function;

        handlerFunc.should.be.Function;
    });
    it("should catch TypeError exception", async() => {
        const handler = "InitThrowsTypeError.handler"
        const appRoot = "test/unit/utils/function";

        const handlerFunc = (await load(
            appRoot,
            handler
        )) as Function;

        handlerFunc.should.be.Function;
        handlerFunc().should.be.true;
    });
});