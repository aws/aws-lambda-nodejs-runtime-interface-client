import { HandlerMetadata } from "./types.js";
import {
  CALLBACK_ERROR_NODEJS22,
  CALLBACK_ERROR_NODEJS24_ABOVE,
} from "../context/constants.js";
import { CallbackHandlerDeprecatedError } from "../utils/errors.js";

const shouldErrorOnCallbackFunction = (metadata?: HandlerMetadata): boolean => {
  return (metadata?.argsNum ?? 0) >= 3 && !metadata?.streaming;
};

const isNodejs22Runtime = (): boolean => {
  return process.env.AWS_EXECUTION_ENV === "AWS_Lambda_nodejs22.x";
};

export function errorOnDeprecatedCallback(metadata?: HandlerMetadata): void {
  if (shouldErrorOnCallbackFunction(metadata)) {
    const errorMessage = isNodejs22Runtime()
      ? CALLBACK_ERROR_NODEJS22
      : CALLBACK_ERROR_NODEJS24_ABOVE;

    throw new CallbackHandlerDeprecatedError(errorMessage);
  }
}
