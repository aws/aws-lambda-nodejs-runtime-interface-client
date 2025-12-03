import type { VerboseLogger } from "./types.js";

const EnvVarName = "AWS_LAMBDA_RUNTIME_VERBOSE";
const Tag = "RUNTIME";

const Verbosity = (() => {
  if (!process.env[EnvVarName]) {
    return 0;
  }

  try {
    const verbosity = parseInt(process.env[EnvVarName]);
    return verbosity < 0 ? 0 : verbosity > 3 ? 3 : verbosity;
  } catch {
    return 0;
  }
})();

export function logger(category: string): VerboseLogger {
  return {
    verbose(...args: unknown[]): void {
      if (Verbosity >= 1) {
        const resolvedArgs = args.map((arg) =>
          typeof arg === "function" ? arg() : arg,
        );
        console.log.apply(null, [Tag, category, ...resolvedArgs]);
      }
    },

    vverbose(...args: unknown[]): void {
      if (Verbosity >= 2) {
        const resolvedArgs = args.map((arg) =>
          typeof arg === "function" ? arg() : arg,
        );
        console.log.apply(null, [Tag, category, ...resolvedArgs]);
      }
    },

    vvverbose(...args: unknown[]): void {
      if (Verbosity >= 3) {
        const resolvedArgs = args.map((arg) =>
          typeof arg === "function" ? arg() : arg,
        );
        console.log.apply(null, [Tag, category, ...resolvedArgs]);
      }
    },
  };
}

export const VerboseLog = { logger };
