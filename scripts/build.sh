#!/bin/bash
set -euo pipefail

TAG=${TAG:-latest}
NODE_VERSION=22.14.0
ARCH=$(uname -m)

echo "Building RIC for $ARCH..."

# Builds curl and aws-lambda-cpp
echo "Building native dependencies..."
docker build \
    -f Dockerfile.native \
    -t "ric/nodejs-native:${TAG}" \
    .

# Builds the RIC with native module and TypeScript
echo "Building full RIC package..."
docker build \
    --build-arg TAG="${TAG}" \
    --build-arg NODE_VERSION="${NODE_VERSION}" \
    -f Dockerfile.js \
    -t "ric/nodejs-js:${TAG}" \
    .

echo "Extracting built package..."

docker run --rm -v $(pwd)/build-artifacts:/output ric/nodejs-js:${TAG} /bin/bash -c "\
    PACKAGE_NAME=\$(ls /app/aws-lambda-ric-*.tgz) && \
    echo \"Found package: \${PACKAGE_NAME}\" && \
    cp \${PACKAGE_NAME} /output/"

echo "Build complete! Package is available in /build-artifacts."
