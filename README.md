## AWS Lambda NodeJS Runtime Interface Client

We have open-sourced a set of software packages, Runtime Interface Clients (RIC), that implement the Lambda
 [Runtime API](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-api.html), allowing you to seamlessly extend your preferred
  base images to be Lambda compatible.
The Lambda Runtime Interface Client is a lightweight interface that allows your runtime to receive requests from and send requests to the Lambda service.

The Lambda NodeJS Runtime Interface Client is vended through [npm](https://www.npmjs.com/package/aws-lambda-ric). 
You can include this package in your preferred base image to make that base image Lambda compatible.

## Requirements
The NodeJS Runtime Interface Client package currently supports NodeJS versions:
 - 16.x
 - 18.x
 - 20.x

## Usage

### Creating a Docker Image for Lambda with the Runtime Interface Client
First step is to choose the base image to be used. The supported Linux OS distributions are:

 - Amazon Linux (2 and 2023)
 - Alpine
 - CentOS
 - Debian
 - Ubuntu

The Runtime Interface Client can be installed outside of the Dockerfile as a dependency of the function we want to run in Lambda (run the below command in your function directory to add the dependency to `package.json`):
```shell script
npm install aws-lambda-ric --save
```
or inside the Dockerfile:
```dockerfile
RUN npm install aws-lambda-ric
```

Next step would be to copy your Lambda function code into the image's working directory.
```dockerfile
# Copy function code
RUN mkdir -p ${FUNCTION_DIR}
COPY myFunction/* ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

# If the dependency is not in package.json uncomment the following line
# RUN npm install aws-lambda-ric

RUN npm install
```

The next step would be to set the `ENTRYPOINT` property of the Docker image to invoke the Runtime Interface Client and then set the `CMD` argument to specify the desired handler.

Example Dockerfile (to keep the image light we used a multi-stage build):
```dockerfile
# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM node:18-buster as build-image

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

# Copy function code
RUN mkdir -p ${FUNCTION_DIR}
COPY myFunction/* ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

RUN npm install

# If the dependency is not in package.json uncomment the following line
# RUN npm install aws-lambda-ric

# Grab a fresh slim copy of the image to reduce the final size
FROM node:18-buster-slim

# Required for Node runtimes which use npm@8.6.0+ because
# by default npm writes logs under /home/.npm and Lambda fs is read-only
ENV NPM_CONFIG_CACHE=/tmp/.npm

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]
```

Example NodeJS handler `app.js`:
```js
"use strict";

exports.handler = async (event, context) => {
    return 'Hello World!';
}
```

### Local Testing

To make it easy to locally test Lambda functions packaged as container images we open-sourced a lightweight web-server, Lambda Runtime Interface Emulator (RIE), which allows your function packaged as a container image to accept HTTP requests. You can install the [AWS Lambda Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator) on your local machine to test your function. Then when you run the image function, you set the entrypoint to be the emulator. 

*To install the emulator and test your Lambda function*

1) From your project directory, run the following command to download the RIE from GitHub and install it on your local machine. 

```shell script
mkdir -p ~/.aws-lambda-rie && \
    curl -Lo ~/.aws-lambda-rie/aws-lambda-rie https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie && \
    chmod +x ~/.aws-lambda-rie/aws-lambda-rie
```
2) Run your Lambda image function using the docker run command. 

```shell script
docker run -d -v ~/.aws-lambda-rie:/aws-lambda -p 9000:8080 \
    --entrypoint /aws-lambda/aws-lambda-rie \
    myfunction:latest \
        /usr/local/bin/npx aws-lambda-ric app.handler
```

This runs the image as a container and starts up an endpoint locally at `http://localhost:9000/2015-03-31/functions/function/invocations`. 

3) Post an event to the following endpoint using a curl command: 

```shell script
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
```

This command invokes the function running in the container image and returns a response.

*Alternately, you can also include RIE as a part of your base image. See the AWS documentation on how to [Build RIE into your base image](https://docs.aws.amazon.com/lambda/latest/dg/images-test.html#images-test-alternative).*


## Development

### Building the package
Clone this repository and run:

```shell script
make init
make build
```

### Running tests

Make sure the project is built:
```shell script
make init build
```
Then,
* to run unit tests: `make test`
* to run integration tests: `make test-integ`
* to run smoke tests: `make test-smoke`

### Raising a PR
When modifying dependencies (`package.json`), make sure to:
1. Run `npm install` to generate an updated `package-lock.json`
2. Commit both `package.json` and `package-lock.json` together

We require package-lock.json to be checked in to ensure consistent installations across development environments.

### Troubleshooting

While running integration tests, you might encounter the Docker Hub rate limit error with the following body:
```
You have reached your pull rate limit. You may increase the limit by authenticating and upgrading: https://www.docker.com/increase-rate-limits
```
To fix the above issue, consider authenticating to a Docker Hub account by setting the Docker Hub credentials as below CodeBuild environment variables.
```shell script
DOCKERHUB_USERNAME=<dockerhub username>
DOCKERHUB_PASSWORD=<dockerhub password>
```
Recommended way is to set the Docker Hub credentials in CodeBuild job by retrieving them from AWS Secrets Manager.
## Security

If you discover a potential security issue in this project we ask that you notify AWS/Amazon Security via our [vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/). Please do **not** create a public github issue.

## License

This project is licensed under the Apache-2.0 License.
