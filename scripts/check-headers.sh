#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

missing_files=()

while IFS= read -r file; do
  if ! grep -q 'Copyright.*Amazon\.com' "$file"; then
    missing_files+=("$file")
  fi
done < <(git ls-files 'bin/**' 'scripts/**' 'src/**' 'test/**' | grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h|sh)$')

if [ ${#missing_files[@]} -gt 0 ]; then
  echo "❌ Copyright header check failed."
  echo "Files missing headers:"
  printf '  %s\n' "${missing_files[@]}"
  echo
  echo "Run 'npm run add-headers' to fix these files."
  exit 1
fi

echo "✅ All files have proper copyright headers."