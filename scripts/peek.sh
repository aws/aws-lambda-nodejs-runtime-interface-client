#!/bin/bash
set -euo pipefail

TEMP_BUILD_DIR="temp_extract"

cleanup() {
    echo "Cleaning up..."
    rm -rf "${TEMP_BUILD_DIR}"
}
trap cleanup EXIT

echo "Starting RIC test setup..."

rm -rf "${TEMP_BUILD_DIR}"
mkdir -p "${TEMP_BUILD_DIR}"

echo "Extracting package..."
tar zxf build-artifacts/aws-lambda-ric-*.tgz -C "${TEMP_BUILD_DIR}"

echo "Building test Docker image..."
docker build \
    -f Dockerfile.peek \
    -t ric-test .

echo "Starting interactive test container..."
docker run -it --rm ric-test
