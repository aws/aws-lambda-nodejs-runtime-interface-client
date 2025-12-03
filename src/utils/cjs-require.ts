import { createRequire } from "module";

export const cjsRequire = createRequire(import.meta.url);
