#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

echo "Running local unit tests for AWS Lambda NodeJS RIC"

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
