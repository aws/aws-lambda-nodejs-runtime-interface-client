import { RAPIDClient, RAPIDClientDependencies } from "../client/index.js";
import {
  UserFunctionLoader,
  errorOnDeprecatedCallback,
} from "../function/index.js";
import { LogPatch, structuredConsole } from "../logging/index.js";
import { Runtime } from "../runtime/index.js";
import { isMultiConcurrentMode } from "./env.js";
import { setupGlobals } from "./globals.js";
import { PlatformError } from "./index.js";

export async function createRuntime(
  rapidClientOptions: RAPIDClientDependencies = {},
): Promise<Runtime> {
  setupGlobals();
  await LogPatch.patchConsole();

  const isMultiConcurrent = isMultiConcurrentMode();
  const runtimeApi = process.env.AWS_LAMBDA_RUNTIME_API;
  const handlerString = process.env._HANDLER;
  const taskRoot = process.env.LAMBDA_TASK_ROOT;

  if (!runtimeApi) {
    throw new PlatformError(
      "AWS_LAMBDA_RUNTIME_API environment variable is not set",
    );
  }
  if (!handlerString) {
    throw new PlatformError("_HANDLER environment variable is not set");
  }
  if (!taskRoot) {
    throw new PlatformError("LAMBDA_TASK_ROOT environment variable is not set");
  }

  const rapidClient = await RAPIDClient.create(
    runtimeApi,
    rapidClientOptions,
    isMultiConcurrent,
  );

  try {
    const { handler, metadata: handlerMetadata } =
      await UserFunctionLoader.load(taskRoot, handlerString);

    // Error on deprecated callback usage
    errorOnDeprecatedCallback(handlerMetadata);

    return Runtime.create({
      rapidClient,
      handler,
      handlerMetadata,
      isMultiConcurrent,
    });
  } catch (error) {
    structuredConsole.logError("Init Error", error);
    await rapidClient.postInitError(error);
    throw error;
  }
}
