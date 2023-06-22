/**
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const { build } = require('esbuild');
const fs = require('fs');

const shared = {
  bundle: true,
  entryPoints: ['index.mjs'],
  external: ['./rapid-client.node'],
  logLevel: 'info',
  minify: false,
  platform: 'node',
  format: 'esm',
  charset: 'utf8',
  banner: {
    js: `/** Copyright 2023 Amazon.com, Inc. or its affiliates. All Rights Reserved. */\nimport { createRequire } from \"module\";\nconst require = createRequire(import.meta.url);`,
  },
};

const buildOneSet = (target) => {
  build({
    ...shared,
    outfile: `../dist/index.mjs`,
    target,
  });

  // Keep backward compatibility for Node14
  if (process.version.startsWith('v14')) {
    build({
      ...shared,
      format: 'cjs',
      entryPoints: ['UserFunction.js'],
      banner: {
        js: '(function (){',
      },
      footer: {
        js: '})();',
      },
      outfile: `../dist/UserFunction.js`,
      target,
    });
  }
};

buildOneSet('node14.21.3');
