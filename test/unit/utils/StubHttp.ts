/** Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

import { RequestOptions, ClientRequest } from "http";
import { URL } from "url";

/**
 * Stub request object.
 * Provides no-op definitions of the request functions used by the Runtime Interface Client.
 */
export const noOpRequest = Object.freeze({
  /* no op, return itself to allow continuations/chaining */
  on: () => noOpRequest,
  /* no op, return itself to allow continuations/chaninig */
  end: () => noOpRequest,
});

export class StubHttp {
  lastUsedOptions: RequestOptions | string | URL;
  Agent: any;

  constructor() {
    this.lastUsedOptions = {};
    this.Agent = class FakeAgent {};
  }

  request(options: RequestOptions | string | URL): ClientRequest {
    this.lastUsedOptions = options;
    return (noOpRequest as unknown) as ClientRequest;
  }
}
