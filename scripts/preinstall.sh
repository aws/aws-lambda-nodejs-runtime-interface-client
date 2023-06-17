#!/bin/sh
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
set -e

ARTIFACTS_DIR=$(pwd)/deps/artifacts

if [ "$(uname)" = "Darwin" ]; then
    echo "aws-lambda-cpp does not build on OS X. Skipping the preinstall step."
else
    if [ -x "$(command -v cmake3)" ]; then
        CMAKE=cmake3
    elif [ -x "$(command -v cmake)" ]; then
        CMAKE=cmake
    else
        echo 'Error: cmake is not installed.' >&2
        exit 1
    fi

    cd deps
    . ./versions

    # unpack dependencies
    tar xzf ./curl-$CURL_VERSION.tar.gz && \
    tar xzf ./aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE.tar.gz

    (
        # Build Curl
        cd curl-curl-$CURL_VERSION && \
            ./buildconf && \
            ./configure \
                --prefix "$ARTIFACTS_DIR" \
                --disable-alt-svc \
                --disable-ares \
                --disable-cookies \
                --disable-crypto-auth \
                --disable-dateparse \
                --disable-dict \
                --disable-dnsshuffle \
                --disable-doh \
                --disable-file \
                --disable-ftp \
                --disable-get-easy-options \
                --disable-gopher \
                --disable-hsts \
                --disable-http-auth \
                --disable-imap \
                --disable-ipv6 \
                --disable-ldap \
                --disable-ldaps \
                --disable-libcurl-option \
                --disable-manual \
                --disable-mime \
                --disable-mqtt \
                --disable-netrc \
                --disable-ntlm-wb \
                --disable-pop3 \
                --disable-progress-meter \
                --disable-proxy \
                --disable-pthreads \
                --disable-rtsp \
                --disable-shared \
                --disable-smtp \
                --disable-socketpair \
                --disable-sspi \
                --disable-telnet \
                --disable-tftp \
                --disable-threaded-resolver \
                --disable-unix-sockets \
                --disable-verbose \
                --disable-versioned-symbols \
                --disable-websockets \
                --with-pic \
                --without-brotli \
                --without-ca-bundle \
                --without-gssapi \
                --without-libidn2 \
                --without-libpsl \
                --without-librtmp \
                --without-libssh2 \
                --without-nghttp2 \
                --without-nghttp3 \
                --without-ngtcp2 \
                --without-ssl \
                --without-zlib \
                --without-zstd && \
            make && \
            make install
    )

    (
        # Build aws-lambda-cpp
        mkdir -p ./aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE/build && \
            cd ./aws-lambda-cpp-$AWS_LAMBDA_CPP_RELEASE/build

        $CMAKE .. \
                -DCMAKE_CXX_FLAGS="-fPIC" \
                -DCMAKE_INSTALL_PREFIX="$ARTIFACTS_DIR" \
                -DCMAKE_MODULE_PATH="$ARTIFACTS_DIR"/lib/pkgconfig && \
            make && make install
    )
fi
