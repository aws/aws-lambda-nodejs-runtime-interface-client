#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

# Create temporary patch to see what would be added
patch_file=$(mktemp)
trap "rm -f $patch_file" EXIT

# Generate patch for missing headers
git ls-files 'bin/**' 'scripts/**' 'src/**' 'test/**' | \
  grep -E '\.(js|ts|mjs|mts|jsx|tsx|c|cpp|h|sh)$' | \
  while read file; do
    if ! grep -q 'Copyright.*Amazon\.com' "$file"; then
      if [[ "$file" == *.sh ]]; then
        header="#!/bin/bash\n# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.\n# SPDX-License-Identifier: Apache-2.0\n\n"
      else
        header="/*\nCopyright Amazon.com, Inc. or its affiliates. All Rights Reserved.\nSPDX-License-Identifier: Apache-2.0\n*/\n\n"
      fi
      
      # Create patch entry
      echo "--- a/$file" >> "$patch_file"
      echo "+++ b/$file" >> "$patch_file"
      echo "@@ -1,1 +1,$(echo -e "$header" | wc -l) @@" >> "$patch_file"
      echo -e "$header" | sed 's/^/+/' >> "$patch_file"
    fi
  done

if [ -s "$patch_file" ]; then
  echo "❌ Copyright header check failed."
  echo "Files missing headers (patch preview):"
  cat "$patch_file"
  echo
  echo "Run 'npm run add-headers' to apply these changes."
  exit 1
fi

echo "✅ All files have proper copyright headers."