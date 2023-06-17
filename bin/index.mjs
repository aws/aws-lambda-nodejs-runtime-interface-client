#!/usr/bin/env node
/** Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

import { run } from "../dist/index.mjs"

if (process.argv.length < 3) {
    throw new Error("No handler specified");
}
  
const appRoot = process.cwd();
const handler = process.argv[2];
  
console.log(`Executing '${handler}' in function directory '${appRoot}'`);
await run(appRoot, handler);