#!/usr/bin/env node

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to process
const patterns = [
  'bin/**/*.js',
  'bin/**/*.ts',
  'bin/**/*.mjs',
  'bin/**/*.mts',
  'bin/**/*.d.ts',
  'bin/**/*.d.mts',
  'scripts/**/*.js',
  'scripts/**/*.ts',
  'scripts/**/*.mjs',
  'scripts/**/*.mts',
  'scripts/**/*.sh',
  'src/**/*.js',
  'src/**/*.ts',
  'src/**/*.mjs',
  'src/**/*.mts',
  'src/**/*.d.ts',
  'src/**/*.d.mts',
  'src/**/*.jsx',
  'src/**/*.tsx',
  'src/**/*.c',
  'src/**/*.cpp',
  'src/**/*.h',
  'test/**/*.js',
  'test/**/*.ts',
  'test/**/*.mjs',
  'test/**/*.mts',
  'test/**/*.sh'
];

// Files/directories to ignore
const ignorePatterns = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  'deps/**'
];

// The headers to add based on file type
const jsHeader = `/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

`;

const shHeader = `#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

`;

function getHeaderForFile(filePath) {
  if (filePath.endsWith('.sh')) {
    return shHeader;
  }
  return jsHeader;
}

function addHeaderToFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const firstFewLines = content.split('\n').slice(0, 10).join('\n');
    
    // Check if file already has both required keywords
    const hasCopyright = firstFewLines.includes('Copyright');
    const hasAmazon = firstFewLines.includes('Amazon.com');
    
    if (hasCopyright && hasAmazon) {
      console.log(`✓ ${filePath} already has a copyright header`);
      return;
    }
    
    // Add header to file
    const header = getHeaderForFile(filePath);
    const newContent = header + content;
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Added copyright header to ${filePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}: ${error.message}`);
  }
}

function main() {
  const options = { ignore: ignorePatterns };
  let filesProcessed = 0;
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, options);
    
    files.forEach(file => {
      addHeaderToFile(file);
      filesProcessed++;
    });
  });
  
  console.log(`\nProcessed ${filesProcessed} files.`);
}

main();