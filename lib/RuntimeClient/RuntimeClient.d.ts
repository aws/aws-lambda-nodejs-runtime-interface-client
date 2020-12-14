/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the Runtime client which is responsible for all HTTP
 * interactions with the Runtime layer.
 */
/// <reference types="node" />
import { Agent, RequestOptions, IncomingMessage, ClientRequest, OutgoingHttpHeaders } from "http";
import { URL } from "url";
import { InvocationResponse, NativeClient } from "../Common";
interface HttpModule {
    Agent: typeof Agent;
    request(options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void): ClientRequest;
}
export interface IRuntimeClient {
    nextInvocation: () => Promise<InvocationResponse>;
    postInvocationError: (error: unknown, id: string, callback: () => void) => void;
    postInvocationResponse: (response: unknown, id: string, callback: () => void) => void;
}
/**
 * Objects of this class are responsible for all interactions with the Runtime
 * API.
 */
export default class RuntimeClient implements IRuntimeClient {
    agent: Agent;
    http: HttpModule;
    nativeClient: NativeClient;
    userAgent: string;
    useAlternativeClient: boolean;
    hostname: string;
    port: number;
    constructor(hostnamePort: string, httpClient?: HttpModule, nativeClient?: NativeClient);
    /**
     * Complete and invocation with the provided response.
     * @param {Object} response
     *   An arbitrary object to convert to JSON and send back as as response.
     * @param {String} id
     *   The invocation ID.
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    postInvocationResponse(response: unknown, id: string, callback: () => void): void;
    /**
     * Post an initialization error to the Runtime API.
     * @param {Error} error
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    postInitError(error: unknown, callback: () => void): void;
    /**
     * Post an invocation error to the Runtime API
     * @param {Error} error
     * @param {String} id
     *   The invocation ID for the in-progress invocation.
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    postInvocationError(error: unknown, id: string, callback: () => void): void;
    /**
     * Get the next invocation.
     * @return {PromiseLike.<Object>}
     *   A promise which resolves to an invocation object that contains the body
     *   as json and the header array. e.g. {bodyJson, headers}
     */
    nextInvocation(): Promise<InvocationResponse>;
    /**
     * HTTP Post to a path.
     * @param {String} path
     * @param {Object} body
     *   The body is serialized into JSON before posting.
     * @param {Object} headers
     *   The http headers
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    _post(path: string, body: unknown, headers: OutgoingHttpHeaders, callback: () => void): void;
}
export {};
//# sourceMappingURL=RuntimeClient.d.ts.map