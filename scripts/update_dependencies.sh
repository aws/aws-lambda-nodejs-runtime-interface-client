#!/bin/bash
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
set -e

cd deps

source versions

# clean up old files
rm -f aws-lambda-cpp-*.tar.gz && rm -f curl-*.tar.gz

# Grab Curl
wget -c https://github.com/curl/curl/archive/refs/tags/curl-$CURL_VERSION.tar.gz -O - | tar -xz

# Apply patches
(
  cd curl-curl-$CURL_VERSION && \
    patch -p1 < ../patches/0001-curl-disable_wakeup.patch
)

# Pack again and remove the folder
tar -czvf curl-$CURL_VERSION.tar.gz curl-curl-$CURL_VERSION && \
  rm -rf curl-curl-$CURL_VERSION

# Grab aws-lambda-cpp
wget -c https://github.com/awslabs/aws-lambda-cpp/archive/refs/tags/v$AWS_LAMBDA_CPP_RELEASE.tar.gz -O - | tar -xz

# Apply patches
(
  cd aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE && \
    patch -p1 < ../patches/aws-lambda-cpp-add-xray-response.patch
)

# Pack again and remove the folder
tar -czvf aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE.tar.gz aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE && \
  rm -rf aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE
