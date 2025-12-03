import { UserHandler } from "../runtime/index.js";
import { HandlerNotFoundError } from "../utils/index.js";

type UnknownObject = Record<string, unknown>;

export function resolveHandler(
  module: unknown,
  handlerName: string,
  fullHandlerString: string,
): UserHandler {
  let handler = findIn(handlerName, module);
  if (
    !handler &&
    typeof module === "object" &&
    module !== null &&
    "default" in module
  ) {
    handler = findIn(handlerName, (module as Record<string, unknown>).default);
  }

  if (!handler) {
    throw new HandlerNotFoundError(
      `${fullHandlerString} is undefined or not exported`,
    );
  }

  if (!isUserHandler(handler)) {
    throw new HandlerNotFoundError(`${fullHandlerString} is not a function`);
  }

  return handler;
}

function findIn(handlerName: string, module: unknown) {
  return handlerName
    .split(".")
    .reduce<unknown | undefined>((nested: unknown, key: string) => {
      return nested && typeof nested === "object"
        ? (nested as UnknownObject)[key]
        : undefined;
    }, module);
}

function isUserHandler(fn: unknown): fn is UserHandler {
  return typeof fn === "function";
}
