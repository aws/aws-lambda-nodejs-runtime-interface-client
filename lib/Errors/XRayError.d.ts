/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
/**
 * prepare an exception blob for sending to AWS X-Ray
 * transform an Error, or Error-like, into an exception parseable by X-Ray's service.
 *  {
 *      "name": "CustomException",
 *      "message": "Something bad happend!",
 *      "stack": [
 *          "exports.handler (/var/function/node_modules/event_invoke.js:3:502)
 *      ]
 *  }
 * =>
 *  {
 *       "working_directory": "/var/function",
 *       "exceptions": [
 *           {
 *               "type": "CustomException",
 *               "message": "Something bad happend!",
 *               "stack": [
 *                   {
 *                       "path": "/var/function/event_invoke.js",
 *                       "line": 502,
 *                       "label": "exports.throw_custom_exception"
 *                   }
 *               ]
 *           }
 *       ],
 *       "paths": [
 *           "/var/function/event_invoke.js"
 *       ]
 *  }
 */
export declare const toFormatted: (err: unknown) => string;
//# sourceMappingURL=XRayError.d.ts.map