/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the Runtime client which is responsible for all HTTP
 * interactions with the Runtime layer.
 */
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Errors = __importStar(require("../Errors"));
const XRayError = __importStar(require("../Errors/XRayError"));
const ERROR_TYPE_HEADER = "Lambda-Runtime-Function-Error-Type";
function userAgent() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const version = require("../../package.json").version;
    return `aws-lambda-nodejs/${process.version}-${version}`;
}
/**
 * Objects of this class are responsible for all interactions with the Runtime
 * API.
 */
class RuntimeClient {
    constructor(hostnamePort, httpClient, nativeClient) {
        this.http = httpClient || require("http");
        this.nativeClient =
            nativeClient || require("../../build/Release/runtime-client.node");
        this.userAgent = userAgent();
        this.nativeClient.initializeClient(this.userAgent);
        this.useAlternativeClient =
            process.env["AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1"] === "true";
        const [hostname, port] = hostnamePort.split(":");
        this.hostname = hostname;
        this.port = parseInt(port, 10);
        this.agent = new this.http.Agent({
            keepAlive: true,
            maxSockets: 1,
        });
    }
    /**
     * Complete and invocation with the provided response.
     * @param {Object} response
     *   An arbitrary object to convert to JSON and send back as as response.
     * @param {String} id
     *   The invocation ID.
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    postInvocationResponse(response, id, callback) {
        const bodyString = _trySerializeResponse(response);
        this.nativeClient.done(id, bodyString);
        callback();
    }
    /**
     * Post an initialization error to the Runtime API.
     * @param {Error} error
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    postInitError(error, callback) {
        const response = Errors.toRuntimeResponse(error);
        this._post(`/2018-06-01/runtime/init/error`, response, { [ERROR_TYPE_HEADER]: response.errorType }, callback);
    }
    /**
     * Post an invocation error to the Runtime API
     * @param {Error} error
     * @param {String} id
     *   The invocation ID for the in-progress invocation.
     * @param {function()} callback
     *   The callback to run after the POST response ends
     */
    postInvocationError(error, id, callback) {
        const response = Errors.toRuntimeResponse(error);
        const bodyString = _trySerializeResponse(response);
        const xrayString = XRayError.toFormatted(error);
        this.nativeClient.error(id, bodyString, xrayString);
        callback();
    }
    /**
     * Get the next invocation.
     * @return {PromiseLike.<Object>}
     *   A promise which resolves to an invocation object that contains the body
     *   as json and the header array. e.g. {bodyJson, headers}
     */
    async nextInvocation() {
        if (this.useAlternativeClient) {
            const options = {
                hostname: this.hostname,
                port: this.port,
                path: "/2018-06-01/runtime/invocation/next",
                method: "GET",
                agent: this.agent,
                headers: {
                    "User-Agent": this.userAgent,
                },
            };
            return new Promise((resolve, reject) => {
                const request = this.http.request(options, (response) => {
                    let data = "";
                    response
                        .setEncoding("utf-8")
                        .on("data", (chunk) => {
                        data += chunk;
                    })
                        .on("end", () => {
                        resolve({
                            bodyJson: data,
                            headers: response.headers,
                        });
                    });
                });
                request
                    .on("error", (e) => {
                    reject(e);
                })
                    .end();
            });
        }
        return this.nativeClient.next();
    }
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
    _post(path, body, headers, callback) {
        const bodyString = _trySerializeResponse(body);
        const options = {
            hostname: this.hostname,
            port: this.port,
            path: path,
            method: "POST",
            headers: Object.assign({
                "Content-Type": "application/json",
                "Content-Length": Buffer.from(bodyString).length,
            }, headers || {}),
            agent: this.agent,
        };
        const request = this.http.request(options, (response) => {
            response
                .on("end", () => {
                callback();
            })
                .on("error", (e) => {
                throw e;
            })
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                .on("data", () => { });
        });
        request
            .on("error", (e) => {
            throw e;
        })
            .end(bodyString, "utf-8");
    }
}
exports.default = RuntimeClient;
/**
 * Attempt to serialize an object as json. Capture the failure if it occurs and
 * throw one that's known to be serializable.
 */
function _trySerializeResponse(body) {
    try {
        return JSON.stringify(body === undefined ? null : body);
    }
    catch (err) {
        throw new Error("Unable to stringify response body");
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUnVudGltZUNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9SdW50aW1lQ2xpZW50L1J1bnRpbWVDbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFFSCxZQUFZLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVliLGtEQUFvQztBQUNwQywrREFBaUQ7QUFFakQsTUFBTSxpQkFBaUIsR0FBRyxvQ0FBb0MsQ0FBQztBQTBCL0QsU0FBUyxTQUFTO0lBQ2hCLDhEQUE4RDtJQUM5RCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFFdEQsT0FBTyxxQkFBcUIsT0FBTyxDQUFDLE9BQU8sSUFBSSxPQUFPLEVBQUUsQ0FBQztBQUMzRCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBcUIsYUFBYTtJQVVoQyxZQUNFLFlBQW9CLEVBQ3BCLFVBQXVCLEVBQ3ZCLFlBQTJCO1FBRTNCLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsWUFBWTtZQUNmLFlBQVksSUFBSSxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUNyRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsRUFBRSxDQUFDO1FBQzdCLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxvQkFBb0I7WUFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0Q0FBNEMsQ0FBQyxLQUFLLE1BQU0sQ0FBQztRQUV2RSxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUMvQixTQUFTLEVBQUUsSUFBSTtZQUNmLFVBQVUsRUFBRSxDQUFDO1NBQ2QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0gsc0JBQXNCLENBQ3BCLFFBQWlCLEVBQ2pCLEVBQVUsRUFDVixRQUFvQjtRQUVwQixNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdkMsUUFBUSxFQUFFLENBQUM7SUFDYixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxhQUFhLENBQUMsS0FBYyxFQUFFLFFBQW9CO1FBQ2hELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsS0FBSyxDQUNSLGdDQUFnQyxFQUNoQyxRQUFRLEVBQ1IsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUMzQyxRQUFRLENBQ1QsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsbUJBQW1CLENBQUMsS0FBYyxFQUFFLEVBQVUsRUFBRSxRQUFvQjtRQUNsRSxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakQsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkQsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELFFBQVEsRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsS0FBSyxDQUFDLGNBQWM7UUFDbEIsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUU7WUFDN0IsTUFBTSxPQUFPLEdBQUc7Z0JBQ2QsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO2dCQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsSUFBSSxFQUFFLHFDQUFxQztnQkFDM0MsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO2dCQUNqQixPQUFPLEVBQUU7b0JBQ1AsWUFBWSxFQUFFLElBQUksQ0FBQyxTQUFTO2lCQUM3QjthQUNGLENBQUM7WUFDRixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO2dCQUNyQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRTtvQkFDdEQsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNkLFFBQVE7eUJBQ0wsV0FBVyxDQUFDLE9BQU8sQ0FBQzt5QkFDcEIsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO3dCQUNwQixJQUFJLElBQUksS0FBSyxDQUFDO29CQUNoQixDQUFDLENBQUM7eUJBQ0QsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7d0JBQ2QsT0FBTyxDQUFDOzRCQUNOLFFBQVEsRUFBRSxJQUFJOzRCQUNkLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTzt5QkFDMUIsQ0FBQyxDQUFDO29CQUNMLENBQUMsQ0FBQyxDQUFDO2dCQUNQLENBQUMsQ0FBQyxDQUFDO2dCQUNILE9BQU87cUJBQ0osRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO29CQUNqQixNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1osQ0FBQyxDQUFDO3FCQUNELEdBQUcsRUFBRSxDQUFDO1lBQ1gsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRUQ7Ozs7Ozs7OztPQVNHO0lBQ0gsS0FBSyxDQUNILElBQVksRUFDWixJQUFhLEVBQ2IsT0FBNEIsRUFDNUIsUUFBb0I7UUFFcEIsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsTUFBTSxPQUFPLEdBQW1CO1lBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixJQUFJLEVBQUUsSUFBSTtZQUNWLE1BQU0sRUFBRSxNQUFNO1lBQ2QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQ3BCO2dCQUNFLGNBQWMsRUFBRSxrQkFBa0I7Z0JBQ2xDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTTthQUNqRCxFQUNELE9BQU8sSUFBSSxFQUFFLENBQ2Q7WUFDRCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7U0FDbEIsQ0FBQztRQUNGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3RELFFBQVE7aUJBQ0wsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7Z0JBQ2QsUUFBUSxFQUFFLENBQUM7WUFDYixDQUFDLENBQUM7aUJBQ0QsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNqQixNQUFNLENBQUMsQ0FBQztZQUNWLENBQUMsQ0FBQztnQkFDRixnRUFBZ0U7aUJBQy9ELEVBQUUsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUIsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPO2FBQ0osRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQ2pCLE1BQU0sQ0FBQyxDQUFDO1FBQ1YsQ0FBQyxDQUFDO2FBQ0QsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM5QixDQUFDO0NBQ0Y7QUEvS0QsZ0NBK0tDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyxxQkFBcUIsQ0FBQyxJQUFhO0lBQzFDLElBQUk7UUFDRixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN6RDtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO0tBQ3REO0FBQ0gsQ0FBQyJ9