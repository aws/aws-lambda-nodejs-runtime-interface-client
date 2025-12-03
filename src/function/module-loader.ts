import { ModuleLoaderOptions } from "./index.js";
import { tryAwaitImport } from "./dynamic-imports.js";
import { ImportModuleError, UserCodeSyntaxError } from "../utils/index.js";
import { cjsRequire } from "../utils/cjs-require.js";

interface NodeError extends Error {
  code?: string;
}

const path = cjsRequire("node:path");

export async function loadModule(options: ModuleLoaderOptions) {
  const fullPathWithoutExtension = path.resolve(
    options.appRoot,
    options.moduleRoot,
    options.moduleName,
  );

  const extensionLookupOrder = ["", ".js", ".mjs", ".cjs"] as const;

  try {
    for (const extension of extensionLookupOrder) {
      const module = await tryAwaitImport(fullPathWithoutExtension, extension);
      if (module) return module;
    }

    const resolvedPath = cjsRequire.resolve(options.moduleName, {
      paths: [options.appRoot, path.join(options.appRoot, options.moduleRoot)],
    });
    return cjsRequire(resolvedPath);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new UserCodeSyntaxError(err);
    } else if (
      err instanceof Error &&
      (err as NodeError).code === "MODULE_NOT_FOUND"
    ) {
      throw new ImportModuleError(err);
    } else {
      throw err;
    }
  }
}
