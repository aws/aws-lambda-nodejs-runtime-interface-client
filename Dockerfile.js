FROM public.ecr.aws/amazonlinux/amazonlinux:2023

ARG TAG=latest
ARG NODE_VERSION=22.14.0

RUN dnf -y install \
    gcc \
    gcc-c++ \
    jq \
    make \
    tar \
    xz \
    gzip \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fL https://nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-"$([[ "$(arch)" == "x86_64" ]] && echo "x64" || echo "arm64")".tar.xz | tar -C /usr --strip-components 1 -xJf - \
    && node --version

# Copy dependencies from native build
COPY --from=ric/nodejs-native:latest /deps.tar.gz /tmp/
RUN mkdir -p /build && \
    tar xzf /tmp/deps.tar.gz -C /build && \
    ls -R /build/deps

# Copy bare config
COPY package.json tsconfig.json eslint.config.js vitest.config.js vitest.setup.ts  /app/

WORKDIR /app

RUN npm install --ignore-scripts

COPY src /app/src
COPY scripts/build.js /app/scripts/build.js

# Build native module
WORKDIR /app/src/native
RUN DEPS_PREFIX=/build/deps npx node-gyp rebuild
RUN cp build/Release/rapid-client.node /app/

# Build TypeScript
WORKDIR /app
RUN npm run build

# Create minimal package.json
RUN jq '{name: .name, version: .version, license: .license, description: .description, main: .main, engines: .engines, type: .type, files: .files}' package.json > package.json.tmp && mv package.json.tmp package.json

# Package for distribution
RUN npm pack
