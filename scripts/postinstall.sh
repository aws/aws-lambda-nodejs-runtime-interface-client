#!/bin/sh
set -e

# Postinstall script for aws-lambda-ric
# Compiles the native Node.js addon and cleans up build artifacts

SCRIPT_DIR=$(dirname "$0")
PACKAGE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
DEPS_DIR="$PACKAGE_DIR/deps"
ARTIFACTS_DIR="$DEPS_DIR/artifacts"

# OS detection - skip on macOS
if [ "$(uname)" = "Darwin" ]; then
    echo "aws-lambda-cpp does not build on OS X. Skipping the postinstall step."
    exit 0
fi

# Verify artifacts directory exists (preinstall should have created it)
if [ ! -d "$ARTIFACTS_DIR" ]; then
    echo "Error: deps/artifacts directory not found. Did preinstall run successfully?" >&2
    exit 1
fi

echo "Building native addon with node-gyp..."

# Run node-gyp with DEPS_PREFIX pointing to built artifacts
cd "$PACKAGE_DIR"
DEPS_PREFIX="$ARTIFACTS_DIR" npm run build:gyp

# Copy rapid-client.node to package root
if [ -f "$PACKAGE_DIR/src/native/build/Release/rapid-client.node" ]; then
    cp "$PACKAGE_DIR/src/native/build/Release/rapid-client.node" "$PACKAGE_DIR/"
    echo "rapid-client.node copied to package root."
else
    echo "Error: rapid-client.node not found after build" >&2
    exit 1
fi

# Clean up when installed as a dependency (in node_modules context)
# Detect if we're in a node_modules installation by checking the path
CURRENT_PATH="$PACKAGE_DIR"
NODE_MODULES_PATTERN="/node_modules/aws-lambda-ric"

case "$CURRENT_PATH" in
    *"$NODE_MODULES_PATTERN"*)
        echo "Cleaning up build artifacts to save space..."
        rm -rf "$DEPS_DIR/aws-lambda-cpp-src"
        rm -rf "$DEPS_DIR/curl-src"
        rm -rf "$ARTIFACTS_DIR"
        rm -rf "$PACKAGE_DIR/src/native/build"
        echo "Cleanup complete."
        ;;
    *)
        echo "Development mode detected. Keeping build artifacts."
        ;;
esac

echo "Postinstall complete."
