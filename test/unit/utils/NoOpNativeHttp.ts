/** Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

import { NativeClient, InvocationResponse } from "../../../src/Common";

export class NoOpNativeHttp implements NativeClient {
  done(): void {
    /*NoOp*/
  }
  error(): void {
    /*NoOp*/
  }
  next(): Promise<InvocationResponse> {
    return Promise.resolve(null as any);
  }
  initializeClient(_userAgent: string): void {
    /*NoOp*/
  }
}
