#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

missing_files=($(git diff --name-only --diff-filter=M HEAD -- 'bin/**' 'scripts/**' 'src/**' 'test/**' | grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h|sh)$' | while read -r file; do
  if ! git show HEAD:"$file" 2>/dev/null | grep -q 'Copyright.*Amazon\.com'; then
    echo "$file"
  fi
done))

if [ ${#missing_files[@]} -gt 0 ]; then
  echo "❌ Copyright header check failed."
  echo "Files missing headers:"
  printf '  %s\n' "${missing_files[@]}"
  echo
  echo "Run 'npm run add-headers' to fix these files."
  exit 1
fi

echo "✅ All files have proper copyright headers."