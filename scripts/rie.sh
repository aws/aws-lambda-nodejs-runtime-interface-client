#!/bin/bash
set -euo pipefail

DOCKERFILE="Dockerfile.rie"

echo "Starting RIE test setup..."

echo "Building test Docker image..."
docker build \
    -f "${DOCKERFILE}" \
    -t ric-runtime-test .

echo "Starting test container..."
docker run -it -p 9000:8080 \
    --rm ric-runtime-test
