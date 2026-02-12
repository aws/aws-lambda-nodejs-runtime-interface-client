#!/bin/sh
set -e

# Preinstall script for aws-lambda-ric
# Builds curl and aws-lambda-cpp from source archives during npm install

SCRIPT_DIR=$(dirname "$0")
PACKAGE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
DEPS_DIR="$PACKAGE_DIR/deps"
ARTIFACTS_DIR="$DEPS_DIR/artifacts"

# OS detection - skip on macOS
if [ "$(uname)" = "Darwin" ]; then
    echo "aws-lambda-cpp does not build on OS X. Skipping the preinstall step."
    exit 0
fi

# Check for cmake (cmake3 or cmake)
if command -v cmake3 >/dev/null 2>&1; then
    CMAKE=cmake3
elif command -v cmake >/dev/null 2>&1; then
    CMAKE=cmake
else
    echo 'Error: cmake is not installed.' >&2
    exit 1
fi

echo "Using cmake: $CMAKE"

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

cd "$DEPS_DIR"

# Build curl
echo "Extracting curl..."
CURL_DIR="$DEPS_DIR/curl-src"
mkdir -p "$CURL_DIR"
# Use -o for busybox tar (Alpine), --no-same-owner for GNU tar
if tar --version 2>/dev/null | grep -q GNU; then
    tar xJf ./curl.tar.xz --strip-components=1 --no-same-owner -C "$CURL_DIR"
else
    tar xJf ./curl.tar.xz --strip-components=1 -o -C "$CURL_DIR"
fi
if [ ! -f "$CURL_DIR/configure" ]; then
    echo "Error: Failed to extract curl archive" >&2
    exit 1
fi

echo "Building curl..."
(
    cd "$CURL_DIR"
    # Only run autoreconf if configure doesn't exist or is older than configure.ac
    if [ ! -f configure ] || [ configure.ac -nt configure ]; then
        autoreconf -fiv
    fi
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
        --without-zstd
    make -j "$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)"
    make install
)

echo "curl build complete."

# Build aws-lambda-cpp
echo "Extracting aws-lambda-cpp..."
AWS_LAMBDA_CPP_DIR="$DEPS_DIR/aws-lambda-cpp-src"
mkdir -p "$AWS_LAMBDA_CPP_DIR"
# Use -o for busybox tar (Alpine), --no-same-owner for GNU tar
if tar --version 2>/dev/null | grep -q GNU; then
    tar xJf ./aws-lambda-cpp.tar.xz --no-same-owner -C "$AWS_LAMBDA_CPP_DIR"
else
    tar xJf ./aws-lambda-cpp.tar.xz -o -C "$AWS_LAMBDA_CPP_DIR"
fi
if [ ! -f "$AWS_LAMBDA_CPP_DIR/CMakeLists.txt" ]; then
    echo "Error: Failed to extract aws-lambda-cpp archive" >&2
    exit 1
fi

echo "Building aws-lambda-cpp..."
(
    cd "$AWS_LAMBDA_CPP_DIR"
    mkdir -p build
    cd build
    
    # Detect musl libc (Alpine) and disable backtrace support
    CMAKE_CXX_FLAGS="-fPIC"
    if ldd --version 2>&1 | grep -q musl; then
        echo "Detected musl libc (Alpine), disabling backtrace support..."
        CMAKE_CXX_FLAGS="-fPIC -DBACKWARD_HAS_BACKTRACE=0 -DBACKWARD_HAS_BACKTRACE_SYMBOL=0"
    fi
    
    $CMAKE .. \
        -DCMAKE_CXX_FLAGS="$CMAKE_CXX_FLAGS" \
        -DCMAKE_INSTALL_PREFIX="$ARTIFACTS_DIR" \
        -DCMAKE_MODULE_PATH="$ARTIFACTS_DIR/lib/pkgconfig"
    make -j "$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)"
    make install
)

echo "aws-lambda-cpp build complete."
echo "Artifacts installed to: $ARTIFACTS_DIR"
