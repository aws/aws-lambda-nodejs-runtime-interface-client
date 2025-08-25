/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

export class HttpResponseStream {
    static from(underlyingStream: any, prelude: any): any;
}

declare global {
    namespace awslambda {
        function streamifyResponse(handler: any, options: any): any;
        let HttpResponseStream: HttpResponseStream;
    }
}