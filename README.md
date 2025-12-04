# AWS Lambda Node.js Runtime Interface Client (RIC)

[![CI](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/actions/workflows/ci.yml/badge.svg)](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/aws-lambda-ric.svg)](https://www.npmjs.com/package/aws-lambda-ric)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

This package implements the AWS Lambda Runtime Interface Client (RIC) for Node.js. It allows you to run Lambda functions in custom container images or local testing environments.

The RIC enables communication between your Lambda function code and the Lambda Runtime API, handling the invoke lifecycle including initialization, invocation, and error reporting.

## Supported Node.js Versions

- Node.js 22.x and above

## Installation

```bash
npm install aws-lambda-ric
```

## Usage

### Basic Usage

Create a handler file (e.g., `index.js`):

```javascript
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from Lambda!' })
  };
};
```

### Using with Container Images

When building custom Lambda container images, use the RIC as the entrypoint:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:22

# Copy function code
COPY index.js ${LAMBDA_TASK_ROOT}

# Install dependencies
COPY package*.json ${LAMBDA_TASK_ROOT}/
RUN npm install

CMD ["index.handler"]
```

### Using with AWS Lambda Runtime Interface Emulator (RIE)

For local testing, you can use the RIC with the [AWS Lambda Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator):

```bash
# Build your container
docker build -t my-lambda-function .

# Run with RIE
docker run -p 9000:8080 my-lambda-function

# Invoke the function
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"message":"test"}'
```

## Building from Source

### Prerequisites

- Node.js 22.x or later
- npm
- Docker (for container builds)
- Make

### Local Development

```bash
# Clone the repository
git clone https://github.com/aws/aws-lambda-nodejs-runtime-interface-client.git
cd aws-lambda-nodejs-runtime-interface-client

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Build Modes

The project supports multiple build modes:

#### Metal Build (Local Development)

Fast build for local development and quick iterations:

```bash
npm run build:metal
```

- TypeScript compilation only
- No native module compilation
- ~5 seconds build time

#### Container Build (Full Build)

Complete build including native module compilation:

```bash
npm run build:container
```

- Builds using Docker on AL2023 base image
- Compiles native C++ dependencies
- Produces deployable artifacts
- ~2-3 minutes build time

### Testing with RIE

To test the runtime using the AWS Lambda Runtime Interface Emulator:

```bash
# Build the project (one-time)
npm run build:container

# Run with RIE
npm run peek:rie

# In another terminal, invoke the function
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"message":"test"}'
```

### Testing in Lambda using Container Image

To deploy and test as a Lambda container function:

```bash
# Build the project
npm run build:container

# Review and update variables in scripts/lambda-build.sh

# Build and deploy
npm run peek:lambda
```

## Architecture

The RIC consists of several components:

- **Runtime Client**: Communicates with the Lambda Runtime API
- **Context Builder**: Constructs the Lambda context object
- **Function Loader**: Loads and resolves user handler functions
- **Logging**: Handles structured logging to CloudWatch
- **Streaming**: Supports response streaming for applicable invocation modes

### Native Module

The RIC includes a native C++ module for high-performance communication with the Lambda Runtime API. This module is built using:

- [aws-lambda-cpp](https://github.com/awslabs/aws-lambda-cpp) - AWS Lambda C++ runtime
- [curl](https://curl.se/) - HTTP client library

Pre-built archives for these dependencies are included in the `deps/` directory.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Security

See [CONTRIBUTING.md](CONTRIBUTING.md#security-issue-notifications) for information on reporting security issues.
