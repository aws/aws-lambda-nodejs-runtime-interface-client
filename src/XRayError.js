/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

module.exports.formatted = (err) => {
  try {
    return JSON.stringify(new XRayFormattedCause(err));
  } catch (err) {
    return '';
  }
};

/**
 * prepare an exception blob for sending to AWS X-Ray
 * adapted from https://code.amazon.com/packages/AWSTracingSDKNode/blobs/c917508ca4fce6a795f95dc30c91b70c6bc6c617/--/core/lib/segments/attributes/captured_exception.js
 * transform an Error, or Error-like, into an exception parseable by X-Ray's service.
 *  {
 *      "name": "CustomException",
 *      "message": "Something bad happend!",
 *      "stack": [
 *          "exports.handler (/var/task/node_modules/event_invoke.js:3:502)
 *      ]
 *  }
 * =>
 *  {
 *       "working_directory": "/var/task",
 *       "exceptions": [
 *           {
 *               "type": "CustomException",
 *               "message": "Something bad happend!",
 *               "stack": [
 *                   {
 *                       "path": "/var/task/event_invoke.js",
 *                       "line": 502,
 *                       "label": "exports.throw_custom_exception"
 *                   }
 *               ]
 *           }
 *       ],
 *       "paths": [
 *           "/var/task/event_invoke.js"
 *       ]
 *  }
 */
class XRayFormattedCause {
  constructor(err) {
    this.working_directory = process.cwd(); // eslint-disable-line

    let stack = [];
    if (err.stack) {
      let stackLines = err.stack.split('\n');
      stackLines.shift();

      stackLines.forEach((stackLine) => {
        let line = stackLine.trim().replace(/\(|\)/g, '');
        line = line.substring(line.indexOf(' ') + 1);

        let label =
          line.lastIndexOf(' ') >= 0
            ? line.slice(0, line.lastIndexOf(' '))
            : null;
        let path =
          label == undefined || label == null || label.length === 0
            ? line
            : line.slice(line.lastIndexOf(' ') + 1);
        path = path.split(':');

        let entry = {
          path: path[0],
          line: parseInt(path[1]),
          label: label || 'anonymous',
        };

        stack.push(entry);
      });
    }

    this.exceptions = [
      {
        type: err.name,
        message: err.message,
        stack: stack,
      },
    ];

    let paths = new Set();
    stack.forEach((entry) => {
      paths.add(entry.path);
    });
    this.paths = Array.from(paths);
  }
}
