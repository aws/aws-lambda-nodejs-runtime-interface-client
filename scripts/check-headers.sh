#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

# Find files missing copyright headers
files=$(git ls-files 'bin/**' 'scripts/**' 'src/**' 'test/**' | \
  grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h|sh)$' | \
  xargs grep -L 'Copyright.*Amazon\.com' || true)

if [ -n "$files" ]; then
  echo "❌ Copyright header check failed."
  echo "Files missing required \"Copyright\" and \"Amazon.com\" keywords:"
  echo "$files" | sed 's/^/  - /'
  echo
  echo "Run 'npm run add-headers' to fix these issues."
  exit 1
fi

echo "✅ All files have proper copyright headers."