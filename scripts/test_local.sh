#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail
trap 'echo "Error on line $LINENO"; exit 1' ERR

echo "Running local unit tests for AWS Lambda NodeJS RIC"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "Error: Docker daemon is not running"
    echo "Please start Docker Desktop and wait for it to initialize"
    exit 1
fi

# Function to run unit tests for specific Node version
run_unit_tests() {
local node_version=$1
echo "Running unit tests for Node.js $node_version..."
docker build -f test/unit/Dockerfile.nodejs${node_version}.x -t unit/nodejs.${node_version}x .
docker run --rm unit/nodejs.${node_version}x
}

# Parse command line arguments
case "${1:-all}" in
"unit")
NODE_VERSION=${2:-"20"}
run_unit_tests $NODE_VERSION
;;
"all")
echo "Running unit tests for all Node versions..."
for version in 18 20 22; do
run_unit_tests $version
done
;;
*)
echo "Usage: $0 [unit|all] [node_version]"
echo "Examples:"
echo " $0 unit 20 # Run unit tests for Node 20"
echo " $0 all # Run unit tests for all Node versions"
exit 1
;;
esac
