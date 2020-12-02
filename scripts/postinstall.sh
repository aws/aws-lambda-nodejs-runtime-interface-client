#!/bin/sh
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
set -e

if [ "$(uname)" = "Darwin" ]; then
    echo "aws-lambda-cpp does not build on OS X. Skipping the postinstall step."
else
    npm run build:gyp
fi

# If the path of this file ends in "node_modules/aws-lambda-ric/scripts"
# the package is being installed as a dependency and we can clean the deps folder.
relative_path="`dirname \"$0\"`"
current_path="`( cd \"$relative_path\" && pwd )`"
node_modules_path="/node_modules/aws-lambda-ric/scripts"

if test "${current_path#*$node_modules_path}" != "$current_path" || [ "$BUILD" != 1 ]; then
    echo "Cleaning up source dependencies to save space"

    deps_path="$current_path/../deps"

    # Clean up source dependencies
    rm -rf "$deps_path"/patches
    rm -rf "$deps_path"/aws-lambda-cpp*[^gz]$
    rm -rf "$deps_path"/curl*[^gz]$
fi
