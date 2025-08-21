#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

# Create patch file
patch_file=$(mktemp)
trap "rm -f $patch_file" EXIT

# Generate patch for missing headers
files_count=0
git ls-files 'bin/**' 'scripts/**' 'src/**' 'test/**' | \
  grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h|sh)$' | \
  while read file; do
    if ! grep -q 'Copyright.*Amazon\.com' "$file"; then
      files_count=$((files_count + 1))
      
      if [[ "$file" == *.sh ]]; then
        header="#!/bin/bash\n# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.\n# SPDX-License-Identifier: Apache-2.0\n\n"
      else
        header="/*\nCopyright Amazon.com, Inc. or its affiliates. All Rights Reserved.\nSPDX-License-Identifier: Apache-2.0\n*/\n\n"
      fi
      
      # Get first line for context
      first_line=$(head -n1 "$file" 2>/dev/null || echo "")
      
      # Create patch entry
      echo "--- a/$file" >> "$patch_file"
      echo "+++ b/$file" >> "$patch_file"
      echo "@@ -1,1 +1,$(echo -e "$header" | wc -l) @@" >> "$patch_file"
      echo -e "$header" | sed 's/^/+/' >> "$patch_file"
      if [ -n "$first_line" ]; then
        echo " $first_line" >> "$patch_file"
      fi
    fi
  done

if [ ! -s "$patch_file" ]; then
  echo "✓ All files already have copyright headers"
  exit 0
fi

echo "Applying copyright header patch..."
git apply "$patch_file"

echo "✓ Copyright headers added successfully"
echo "Run 'git diff --cached' or 'git diff' to review changes"