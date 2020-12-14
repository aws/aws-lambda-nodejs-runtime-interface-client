/* eslint-disable no-console */
/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module is the bootstrap entrypoint. It establishes the top-level event
 * listeners and loads the user's code.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const Errors = __importStar(require("./Errors"));
const RuntimeClient_1 = __importDefault(require("./RuntimeClient"));
const Runtime_1 = __importDefault(require("./Runtime"));
const BeforeExitListener_1 = __importDefault(require("./Runtime/BeforeExitListener"));
const LogPatch_1 = __importDefault(require("./utils/LogPatch"));
const UserFunction = __importStar(require("./utils/UserFunction"));
LogPatch_1.default.patchConsole();
function run(appRoot, handler) {
    if (!process.env.AWS_LAMBDA_RUNTIME_API) {
        throw new Error("Missing Runtime API Server configuration.");
    }
    const client = new RuntimeClient_1.default(process.env.AWS_LAMBDA_RUNTIME_API);
    const errorCallbacks = {
        uncaughtException: (error) => {
            client.postInitError(error, () => process.exit(129));
        },
        unhandledRejection: (error) => {
            client.postInitError(error, () => process.exit(128));
        },
    };
    process.on("uncaughtException", (error) => {
        console.error("Uncaught Exception", Errors.toFormatted(error));
        errorCallbacks.uncaughtException(error);
    });
    process.on("unhandledRejection", (reason, promise) => {
        const error = new Errors.UnhandledPromiseRejection(reason === null || reason === void 0 ? void 0 : reason.toString(), promise);
        console.error("Unhandled Promise Rejection", Errors.toFormatted(error));
        errorCallbacks.unhandledRejection(error);
    });
    BeforeExitListener_1.default.reset();
    process.on("beforeExit", BeforeExitListener_1.default.invoke);
    const handlerFunc = UserFunction.load(appRoot, handler);
    const runtime = new Runtime_1.default(client, handlerFunc, errorCallbacks);
    runtime.scheduleIteration();
}
exports.run = run;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsK0JBQStCO0FBQy9COzs7OztHQUtHO0FBRUgsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR2IsaURBQW1DO0FBQ25DLG9FQUE0QztBQUM1Qyx3REFBZ0M7QUFDaEMsc0ZBQThEO0FBQzlELGdFQUF3QztBQUN4QyxtRUFBcUQ7QUFFckQsa0JBQVEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztBQUV4QixTQUFnQixHQUFHLENBQUMsT0FBZSxFQUFFLE9BQWU7SUFDbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLEVBQUU7UUFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0tBQzlEO0lBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSx1QkFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUVyRSxNQUFNLGNBQWMsR0FBRztRQUNyQixpQkFBaUIsRUFBRSxDQUFDLEtBQVksRUFBRSxFQUFFO1lBQ2xDLE1BQU0sQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBQ0Qsa0JBQWtCLEVBQUUsQ0FBQyxLQUFZLEVBQUUsRUFBRTtZQUNuQyxNQUFNLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkQsQ0FBQztLQUNGLENBQUM7SUFFRixPQUFPLENBQUMsRUFBRSxDQUFDLG1CQUFtQixFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7UUFDeEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDL0QsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFDLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUNuRCxNQUFNLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyx5QkFBeUIsQ0FDaEQsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLFFBQVEsSUFDaEIsT0FBTyxDQUNSLENBQUM7UUFDRixPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN4RSxjQUFjLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0MsQ0FBQyxDQUFDLENBQUM7SUFFSCw0QkFBa0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUMzQixPQUFPLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSw0QkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVwRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQW9CLENBQUM7SUFDM0UsTUFBTSxPQUFPLEdBQUcsSUFBSSxpQkFBTyxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFakUsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDOUIsQ0FBQztBQXBDRCxrQkFvQ0MifQ==