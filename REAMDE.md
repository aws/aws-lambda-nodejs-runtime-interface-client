## AWS Lambda NodeJs Runtime Interface Client

The Lambda Runtime Interface Client helps with packaging functions using your own or community provided images. 
It allows your runtime to receive requests from and send requests to the Lambda service. 
The Runtime client starts the runtime and communicates with the Lambda [Runtime API](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-api.html) i.e., it calls the API for invocation events, starts the function code, calls the API to return the response. 
The Lambda NodeJs Runtime Interface Client is vended through [npm](https://www.npmjs.com/package/aws-lambda-ric). 
You can include this package in your preferred base image to make that base image Lambda compatible.

## Usage

### Creating a Docker Image for Lambda with the Runtime Interface Client
First step is to choose the base image to be used. The supported Linux OS distributions are:

 - Amazon Linux 2
 - Alpine
 - CentOS
 - Debian
 - Ubuntu

The Runtime Interface Client can be installed outside of the Dockerfile as a dependency of the function we want to run in Lambda (run the below command in your function directory to add the dependency to `package.json`):
```
npm install aws-lambda-ric --save
```
or inside the Dockerfile:
```Docker
RUN npm install aws-lambda-ric
```

Next step would be to copy your Lambda function code into the image's working directory.
```Docker
# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

# Copy handler function
COPY myFunction/* ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

# If the dependency is not in package.json uncomment the following line
# RUN npm install aws-lambda-ric

RUN npm install
```

The next step would be to set the `ENTRYPOINT` property of the Docker image to invoke the Runtime Interface Client and then set the `CMD` argument to specify the desired handler.

Example Dockerfile (to keep the image light we used another image to install the runtime):
```Docker
# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM node:12-buster as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Install aws-lambda-cpp build dependencies
RUN apt-get update && \
    apt-get install -y \
    g++ \
    make \
    cmake \
    unzip \
    libcurl4-openssl-dev

# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

# Copy handler function
COPY myFunction/* ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

RUN npm install aws-lambda-ric

RUN npm install

# Grab a fresh slim copy of the image to reduce the final size
FROM node:12-buster-slim

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["app.lambdaHandler"]

```
Example of handler:

`app.js`
```js
"use strict";

exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event));
    console.log('Context:', JSON.stringify(context));

    return 'success!';
}
```

### Local Testing

For testing locally you will need to set up a local Runtime Interface Emulator against which the Runtime Interface Client will make API calls. You will need to post data to the endpoint it creates in order to invoke your function. For more information check out the [Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator).

## Security

If you discover a potential security issue in this project we ask that you notify AWS/Amazon Security via our [vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/). Please do **not** create a public github issue.

## License

This project is licensed under the Apache-2.0 License.

