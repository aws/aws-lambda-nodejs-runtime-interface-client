#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

# Find files missing copyright headers
files=$(git ls-files 'bin/**' 'scripts/**' 'src/**' 'test/**' | \
  grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h)$' | \
  xargs grep -L 'Copyright.*Amazon\.com' || true)

if [ -z "$files" ]; then
  echo "✓ All files already have copyright headers"
  exit 0
fi

echo "Found $(echo "$files" | wc -l) files missing headers"

# Add headers
for file in $files; do
  if [[ "$file" == *.sh ]]; then
    header="#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"
  else
    header="/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

"
  fi
  
  echo "$header$(cat "$file")" > "$file"
  echo "✓ Added header to $file"
done

echo
echo "✓ All copyright headers added successfully"
echo "Run 'git diff' to review changes before committing"