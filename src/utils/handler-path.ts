import { MalformedHandlerNameError } from "./errors.js";
import { cjsRequire } from "./cjs-require.js";

const path = cjsRequire("node:path");

export interface ParsedHandler {
  moduleRoot: string;
  moduleName: string;
  handlerName: string;
}

const FUNCTION_EXPR = /^([^.]*)\.(.*)$/;

export function parseHandlerString(fullHandlerString: string): ParsedHandler {
  const handlerString = path.basename(fullHandlerString);
  const moduleRoot = fullHandlerString.substring(
    0,
    fullHandlerString.indexOf(handlerString),
  );

  const match = handlerString.match(FUNCTION_EXPR);
  if (!match || match.length !== 3) {
    throw new MalformedHandlerNameError("Bad handler");
  }

  return {
    moduleRoot: moduleRoot.replace(/\/$/, ""), // Remove trailing slash
    moduleName: match[1],
    handlerName: match[2],
  };
}
