/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFormatted = void 0;
const _1 = require(".");
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
exports.toFormatted = (err) => {
    if (!_1.isError(err)) {
        return "";
    }
    try {
        return JSON.stringify(new XRayFormattedCause(err));
    }
    catch (error) {
        return "";
    }
};
class XRayFormattedCause {
    constructor(err) {
        this.working_directory = process.cwd(); // eslint-disable-line
        const stack = [];
        if (err.stack) {
            const stackLines = err.stack.split("\n");
            stackLines.shift();
            stackLines.forEach((stackLine) => {
                let line = stackLine.trim().replace(/\(|\)/g, "");
                line = line.substring(line.indexOf(" ") + 1);
                const label = line.lastIndexOf(" ") >= 0
                    ? line.slice(0, line.lastIndexOf(" "))
                    : null;
                const path = label == undefined || label == null || label.length === 0
                    ? line
                    : line.slice(line.lastIndexOf(" ") + 1);
                const pathParts = path.split(":");
                const entry = {
                    path: pathParts[0],
                    line: parseInt(pathParts[1]),
                    label: label || "anonymous",
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
        const paths = new Set();
        stack.forEach((entry) => {
            paths.add(entry.path);
        });
        this.paths = Array.from(paths);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWFJheUVycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0Vycm9ycy9YUmF5RXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOEVBQThFO0FBRTlFLFlBQVksQ0FBQzs7O0FBRWIsd0JBQTRCO0FBRTVCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E4Qkc7QUFDVSxRQUFBLFdBQVcsR0FBRyxDQUFDLEdBQVksRUFBVSxFQUFFO0lBQ2xELElBQUksQ0FBQyxVQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDakIsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELElBQUk7UUFDRixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ3BEO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxPQUFPLEVBQUUsQ0FBQztLQUNYO0FBQ0gsQ0FBQyxDQUFDO0FBY0YsTUFBTSxrQkFBa0I7SUFLdEIsWUFBWSxHQUFVO1FBQ3BCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxzQkFBc0I7UUFFOUQsTUFBTSxLQUFLLEdBQXFCLEVBQUUsQ0FBQztRQUNuQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUU7WUFDYixNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN6QyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7WUFFbkIsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsRUFBRSxFQUFFO2dCQUMvQixJQUFJLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDbEQsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFFN0MsTUFBTSxLQUFLLEdBQ1QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO29CQUN4QixDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFFWCxNQUFNLElBQUksR0FDUixLQUFLLElBQUksU0FBUyxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUN2RCxDQUFDLENBQUMsSUFBSTtvQkFDTixDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUU1QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUVsQyxNQUFNLEtBQUssR0FBRztvQkFDWixJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztvQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzVCLEtBQUssRUFBRSxLQUFLLElBQUksV0FBVztpQkFDNUIsQ0FBQztnQkFFRixLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3BCLENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxJQUFJLENBQUMsVUFBVSxHQUFHO1lBQ2hCO2dCQUNFLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtnQkFDZCxPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87Z0JBQ3BCLEtBQUssRUFBRSxLQUFLO2FBQ2I7U0FDRixDQUFDO1FBRUYsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNoQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDdEIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGIn0=