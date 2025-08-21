#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

script_dir="$(dirname "$0")"
files_modified=0

while IFS= read -r file; do
  if ! grep -q 'Copyright.*Amazon\.com' "$file"; then
    if [[ "$file" == *.sh ]]; then
      sed "s|PLACEHOLDER|$file|" "$script_dir/patches/sh-files.patch" | git apply
    else
      sed "s|PLACEHOLDER|$file|" "$script_dir/patches/js-files.patch" | git apply
    fi
    files_modified=$((files_modified + 1))
  fi
done < <(git ls-files 'bin/**' 'scripts/**' 'src/**' 'test/**' | grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h|sh)$')

if [ "$files_modified" -eq 0 ]; then
  echo "✓ All files already have copyright headers"
else
  echo "✓ Copyright headers added to $files_modified files"
  echo "Run 'git diff' to review changes"
fi