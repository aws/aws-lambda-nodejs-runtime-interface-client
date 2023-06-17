export class HttpResponseStream {
    static from(underlyingStream: any, prelude: any): any;
}

declare namespace awslambda {
    function streamifyResponse(handler: any, options: any): any;
    let HttpResponseStream: HttpResponseStream;
}