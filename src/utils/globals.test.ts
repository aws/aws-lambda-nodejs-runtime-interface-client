import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupGlobals } from "./globals.js";
import { HttpResponseStream } from "../stream/index.js";

describe("globals", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).awslambda;
  });

  afterEach(() => {
    process.env = originalEnv;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).awslambda;
  });

  it("should set up global awslambda object by default", () => {
    // WHEN
    setupGlobals();

    // THEN
    expect(globalThis.awslambda).toBeDefined();
    expect(globalThis.awslambda.streamifyResponse).toBeInstanceOf(Function);
    expect(globalThis.awslambda.HttpResponseStream).toBe(HttpResponseStream);
  });

  it("should not set up global awslambda object when disabled", () => {
    // GIVEN
    process.env.AWS_LAMBDA_NODEJS_NO_GLOBAL_AWSLAMBDA = "true";

    // WHEN
    setupGlobals();

    // THEN
    expect(globalThis.awslambda).toBeUndefined();
  });

  it("should configure handler with streaming metadata", () => {
    // GIVEN
    setupGlobals();
    const handler = () => {};

    // WHEN
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (globalThis.awslambda.streamifyResponse as any)(handler, {
      highWaterMark: 1024,
    });

    // THEN
    expect(result).toBe(handler);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any)[Symbol.for("aws.lambda.runtime.handler.streaming")],
    ).toBe("response");
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any)[
        Symbol.for("aws.lambda.runtime.handler.streaming.highWaterMark")
      ],
    ).toBe(1024);
  });

  it("should preserve existing awslambda properties", () => {
    // GIVEN
    const existingProperty = { someExistingFunction: () => "test" };
    globalThis.awslambda = existingProperty;

    // WHEN
    setupGlobals();

    // THEN
    expect(globalThis.awslambda).toBeDefined();
    expect(globalThis.awslambda.someExistingFunction).toBe(
      existingProperty.someExistingFunction,
    );
    expect(globalThis.awslambda.streamifyResponse).toBeInstanceOf(Function);
    expect(globalThis.awslambda.HttpResponseStream).toBe(HttpResponseStream);
  });
});
