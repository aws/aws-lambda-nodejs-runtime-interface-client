#!/bin/bash
set -euo pipefail

# Variables
IMAGE_NAME="standard"
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"
ECR_REPO_NAME="strong"
ECR_URI="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
TAG="latest"
FUNCTION_NAME=${IMAGE_NAME}
ROLE_NAME="lambda-ric-test-role"

# Ensure build artifacts exist
if ! ls build-artifacts/aws-lambda-ric-*.tgz 1> /dev/null 2>&1; then
    echo "Build artifacts not found. Run 'npm run build:container' first."
    exit 1
fi

# Detect architecture from the Docker image that was built
DOCKER_ARCH=$(docker inspect ric/nodejs-js:latest --format '{{.Architecture}}' 2>/dev/null || echo "")
if [[ "$DOCKER_ARCH" == "arm64" ]]; then
    LAMBDA_ARCH="arm64"
    PLATFORM="linux/arm64"
elif [[ "$DOCKER_ARCH" == "amd64" ]]; then
    LAMBDA_ARCH="x86_64"
    PLATFORM="linux/amd64"
else
    # Fallback to host architecture
    HOST_ARCH=$(uname -m)
    if [[ "$HOST_ARCH" == "arm64" || "$HOST_ARCH" == "aarch64" ]]; then
        LAMBDA_ARCH="arm64"
        PLATFORM="linux/arm64"
    else
        LAMBDA_ARCH="x86_64"
        PLATFORM="linux/amd64"
    fi
fi
echo "Detected architecture: $LAMBDA_ARCH (platform: $PLATFORM)"

# Build Lambda image (--provenance=false ensures Docker v2 format compatible with Lambda)
docker build --provenance=false --platform "${PLATFORM}" -t ${IMAGE_NAME}:${TAG} -f Dockerfile.lambda .

# Check if ECR repository exists, create if it doesn't
if ! aws ecr describe-repositories --region ${AWS_REGION} --repository-names ${ECR_REPO_NAME} &> /dev/null; then
    echo "Creating ECR repository ${ECR_REPO_NAME}"
    aws ecr create-repository --region ${AWS_REGION} --repository-name ${ECR_REPO_NAME}
else
    echo "ECR repository ${ECR_REPO_NAME} already exists"
fi

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Tag and push
docker tag ${IMAGE_NAME}:${TAG} ${ECR_URI}/${ECR_REPO_NAME}:${TAG}
docker push ${ECR_URI}/${ECR_REPO_NAME}:${TAG}

echo "Image pushed to ${ECR_URI}/${ECR_REPO_NAME}:${TAG}"

# Lambda Role check
# Check if the role exists, create if it doesn't
if ! aws iam get-role --region ${AWS_REGION} --role-name ${ROLE_NAME} &> /dev/null; then
    echo "Creating IAM role ${ROLE_NAME}"
    aws iam create-role \
        --role-name ${ROLE_NAME} \
        --region ${AWS_REGION} \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "lambda.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }'

    # Attach the AWSLambdaBasicExecutionRole policy
    aws iam attach-role-policy \
        --role-name ${ROLE_NAME} \
        --region ${AWS_REGION} \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    echo "Waiting for IAM role to propagate..."
    sleep 10  # Wait for role to propagate
else
    echo "IAM role ${ROLE_NAME} already exists"
fi

# Get the role ARN
ROLE_ARN=$(aws iam get-role --region ${AWS_REGION} --role-name ${ROLE_NAME} --query 'Role.Arn' --output text)

# Check if the function exists
if aws lambda get-function --region ${AWS_REGION} --function-name ${FUNCTION_NAME} &> /dev/null; then
    # Check if architecture matches
    CURRENT_ARCH=$(aws lambda get-function-configuration --region ${AWS_REGION} --function-name ${FUNCTION_NAME} --query 'Architectures[0]' --output text)
    if [[ "$CURRENT_ARCH" != "$LAMBDA_ARCH" ]]; then
        echo "Architecture mismatch: Lambda is $CURRENT_ARCH, image is $LAMBDA_ARCH"
        echo "Deleting and recreating function with correct architecture..."
        aws lambda delete-function --region ${AWS_REGION} --function-name ${FUNCTION_NAME}
        sleep 5
        echo "Creating Lambda function ${FUNCTION_NAME} with architecture ${LAMBDA_ARCH}"
        aws lambda create-function \
            --region ${AWS_REGION} \
            --function-name ${FUNCTION_NAME} \
            --package-type Image \
            --code ImageUri=${ECR_URI}/${ECR_REPO_NAME}:${TAG} \
            --role ${ROLE_ARN} \
            --architectures ${LAMBDA_ARCH} \
            --timeout 30 \
            --memory-size 128
    else
        echo "Updating existing Lambda function ${FUNCTION_NAME}"
        aws lambda update-function-code \
            --region ${AWS_REGION} \
            --function-name ${FUNCTION_NAME} \
            --image-uri ${ECR_URI}/${ECR_REPO_NAME}:${TAG}
    fi
else
    echo "Creating new Lambda function ${FUNCTION_NAME} with architecture ${LAMBDA_ARCH}"
    aws lambda create-function \
        --region ${AWS_REGION} \
        --function-name ${FUNCTION_NAME} \
        --package-type Image \
        --code ImageUri=${ECR_URI}/${ECR_REPO_NAME}:${TAG} \
        --role ${ROLE_ARN} \
        --architectures ${LAMBDA_ARCH} \
        --timeout 30 \
        --memory-size 128
fi

echo "Deployment completed successfully"
