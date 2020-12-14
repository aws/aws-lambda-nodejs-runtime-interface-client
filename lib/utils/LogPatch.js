/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
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
const fs = __importStar(require("fs"));
const util = __importStar(require("util"));
const levels = Object.freeze({
    INFO: { name: "INFO" },
    DEBUG: { name: "DEBUG" },
    WARN: { name: "WARN" },
    ERROR: { name: "ERROR" },
    TRACE: { name: "TRACE" },
    FATAL: { name: "FATAL" },
});
/* Use a unique symbol to provide global access without risk of name clashes. */
const REQUEST_ID_SYMBOL = Symbol.for("aws.lambda.runtime.requestId");
const _currentRequestId = {
    get: () => global[REQUEST_ID_SYMBOL],
    set: (id) => (global[REQUEST_ID_SYMBOL] = id),
};
/**
 * Write logs to stdout.
 */
const _logToStdout = (level, message) => {
    const time = new Date().toISOString();
    const requestId = _currentRequestId.get();
    let line = `${time}\t${requestId}\t${level.name}\t${message}`;
    line = line.replace(/\n/g, "\r");
    process.stdout.write(line + "\n");
};
/**
 * Write logs to filedescriptor.
 * Implements the logging contract between runtimes and the platform.
 * Each entry is framed as:
 *    +----------------------+------------------------+-----------------------+
 *    | Frame Type - 4 bytes | Length (len) - 4 bytes | Message - 'len' bytes |
 *    +----------------------+------------------------+-----------------------+
 * The frist 4 bytes are the frame type. For logs this is always 0xa55a0001.
 * The second 4 bytes are the length of the message.
 * The remaining bytes ar ethe message itself. Byte order is big-endian.
 */
const _logToFd = function (logTarget) {
    const typeAndLength = Buffer.alloc(8);
    typeAndLength.writeUInt32BE(0xa55a0001, 0);
    typeAndLength.writeUInt32BE(0x00000000, 4);
    return (level, message) => {
        const time = new Date().toISOString();
        const requestId = _currentRequestId.get();
        const enrichedMessage = `${time}\t${requestId}\t${level.name}\t${message}\n`;
        const messageBytes = Buffer.from(enrichedMessage, "utf8");
        typeAndLength.writeInt32BE(messageBytes.length, 4);
        fs.writeSync(logTarget, typeAndLength);
        fs.writeSync(logTarget, messageBytes);
    };
};
/**
 * Replace console functions with a log function.
 * @param {Function(level, String)} log
 */
function _patchConsoleWith(log) {
    console.log = (msg, ...params) => {
        log(levels.INFO, util.format(msg, ...params));
    };
    console.debug = (msg, ...params) => {
        log(levels.DEBUG, util.format(msg, ...params));
    };
    console.info = (msg, ...params) => {
        log(levels.INFO, util.format(msg, ...params));
    };
    console.warn = (msg, ...params) => {
        log(levels.WARN, util.format(msg, ...params));
    };
    console.error = (msg, ...params) => {
        log(levels.ERROR, util.format(msg, ...params));
    };
    console.trace = (msg, ...params) => {
        log(levels.TRACE, util.format(msg, ...params));
    };
    console.fatal = (msg, ...params) => {
        log(levels.FATAL, util.format(msg, ...params));
    };
}
const _patchConsole = () => {
    if (process.env["_LAMBDA_TELEMETRY_LOG_FD"] != null &&
        process.env["_LAMBDA_TELEMETRY_LOG_FD"] != undefined) {
        const logFd = parseInt(process.env["_LAMBDA_TELEMETRY_LOG_FD"]);
        _patchConsoleWith(_logToFd(logFd));
        delete process.env["_LAMBDA_TELEMETRY_LOG_FD"];
    }
    else {
        _patchConsoleWith(_logToStdout);
    }
};
exports.default = {
    setCurrentRequestId: _currentRequestId.set,
    patchConsole: _patchConsole,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9nUGF0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvTG9nUGF0Y2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdURBQXVEO0FBQ3ZELCtCQUErQjtBQUMvQiw4RUFBOEU7QUFFOUUsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFYix1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDM0IsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRTtJQUN0QixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0lBQ3hCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7SUFDdEIsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtJQUN4QixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0lBQ3hCLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7Q0FDekIsQ0FBQyxDQUFDO0FBRUgsZ0ZBQWdGO0FBQ2hGLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO0FBQ3JFLE1BQU0saUJBQWlCLEdBQUc7SUFDeEIsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFFLE1BQWMsQ0FBQyxpQkFBaUIsQ0FBQztJQUM3QyxHQUFHLEVBQUUsQ0FBQyxFQUFPLEVBQUUsRUFBRSxDQUFDLENBQUUsTUFBYyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQzVELENBQUM7QUFFRjs7R0FFRztBQUNILE1BQU0sWUFBWSxHQUFHLENBQUMsS0FBVSxFQUFFLE9BQVksRUFBRSxFQUFFO0lBQ2hELE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDdEMsTUFBTSxTQUFTLEdBQUcsaUJB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