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

# Build Lambda image
docker build -t ${IMAGE_NAME}:${TAG} -f Dockerfile.lambda .

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
    echo "Updating existing Lambda function ${FUNCTION_NAME}"
    aws lambda update-function-code \
        --region ${AWS_REGION} \
        --function-name ${FUNCTION_NAME} \
        --image-uri ${ECR_URI}/${ECR_REPO_NAME}:${TAG}
else
    echo "Creating new Lambda function ${FUNCTION_NAME}"
    aws lambda create-function \
        --region ${AWS_REGION} \
        --function-name ${FUNCTION_NAME} \
        --package-type Image \
        --code ImageUri=${ECR_URI}/${ECR_REPO_NAME}:${TAG} \
        --role ${ROLE_ARN} \
        --timeout 30 \
        --memory-size 128
fi

echo "Deployment completed successfully"
