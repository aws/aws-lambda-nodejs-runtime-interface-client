/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the InvokeContext and supporting functions. The
 * InvokeContext is responsible for pulling information from the invoke headers
 * and for wrapping the Runtime Client object's error and response functions.
 */
/// <reference types="node" />
import { IncomingHttpHeaders } from "http";
import { ICallbackContext, IHeaderData, IEnvironmentData } from "../Common";
export default class InvokeContext {
    headers: IncomingHttpHeaders;
    constructor(headers: IncomingHttpHeaders);
    private getHeaderValue;
    /**
     * The invokeId for this request.
     */
    get invokeId(): string;
    /**
     * The header data for this request.
     */
    get headerData(): IHeaderData;
    /**
     * Push relevant invoke data into the logging context.
     */
    updateLoggingContext(): void;
    /**
     * Attach all of the relavant environmental and invocation data to the
     * provided object.
     * This method can throw if the headers are malformed and cannot be parsed.
     * @param callbackContext {Object}
     *   The callbackContext object returned by a call to buildCallbackContext().
     * @return {Object}
     *   The user context object with all required data populated from the headers
     *   and environment variables.
     */
    attachEnvironmentData(callbackContext: ICallbackContext): ICallbackContext & IEnvironmentData & IHeaderData;
    /**
     * All parts of the user-facing context object which are provided through
     * environment variables.
     */
    private _environmentalData;
    /**
     * All parts of the user-facing context object which are provided through
     * request headers.
     */
    private _headerData;
    /**
     * Forward the XRay header into the environment variable.
     */
    private _forwardXRay;
}
//# sourceMappingURL=InvokeContext.d.ts.map