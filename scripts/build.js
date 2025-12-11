import { build } from "esbuild";

const ENTRY_FILE = "dist/index.js";
const OUT_FILE = "index.mjs";

build({
  entryPoints: [ENTRY_FILE],
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: false,
  minify: false,
  outfile: OUT_FILE,
  banner: {
    js: "#!/usr/bin/env node",
  },
})
  .then(() => {
    console.log("esbuild succeeded: output at", OUT_FILE);
  })
  .catch((e) => {
    console.error("esbuild failed:", e);
    process.exit(1);
  });
