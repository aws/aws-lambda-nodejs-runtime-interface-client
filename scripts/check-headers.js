#!/usr/bin/env node

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to check
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

// The required header content keywords
const requiredKeywords = ['Copyright', 'Amazon.com'];

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const firstFewLines = content.split('\n').slice(0, 10).join('\n');
    
    const missingKeywords = requiredKeywords.filter(keyword => 
      !firstFewLines.includes(keyword)
    );
    
    if (missingKeywords.length > 0) {
      console.error(`❌ Missing required keywords in header of: ${filePath}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return false;
  }
}

function main() {
  let allPassed = true;
  const options = { ignore: ignorePatterns };
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, options);
    
    files.forEach(file => {
      if (!checkFile(file)) {
        allPassed = false;
      }
    });
  });
  
  if (!allPassed) {
    console.error(`\nCopyright header check failed. Files must include both "Copyright" and "Amazon.com" in their header.`);
    process.exit(1);
  } else {
    console.log('✅ All files have proper copyright headers.');
  }
}

main();