import { cjsRequire } from "../utils/cjs-require.js";
const { existsSync } = cjsRequire("node:fs");

export async function tryAwaitImport(file: string, extension?: string) {
  const path = `${file}${extension || ""}`;
  return existsSync(path) ? await import(path) : undefined;
}
