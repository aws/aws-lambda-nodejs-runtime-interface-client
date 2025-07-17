/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');

describe('check-headers script', function() {
  it('should detect files with proper headers', function() {
    // This test file itself has the proper header
    const result = execSync('node ./scripts/check-headers.js', {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe'
    }).toString();
    
    assert.ok(result.includes('✅ All files have proper copyright headers'));
  });
});