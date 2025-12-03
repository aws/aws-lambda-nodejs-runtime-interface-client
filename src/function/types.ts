import { UserHandler } from "../runtime/index.js";

export interface HandlerMetadata {
  streaming?: boolean;
  highWaterMark?: number;
  argsNum?: number;
}

export interface LoadedHandler {
  handler: UserHandler;
  metadata: HandlerMetadata;
}

export interface ModuleLoaderOptions {
  appRoot: string;
  moduleRoot: string;
  moduleName: string;
}
