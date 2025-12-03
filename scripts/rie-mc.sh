#!/bin/bash
set -euo pipefail

DOCKERFILE="Dockerfile.rie.mc"

echo "Starting RIE test setup..."

echo "Building test Docker image..."
docker build \
    -f "${DOCKERFILE}" \
    -t ric-runtime-test .

echo "Starting test container..."
docker run -it -p 9000:8080 \
    --cpus 2 \
    --rm ric-runtime-test
