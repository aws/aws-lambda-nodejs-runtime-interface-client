export const REQUIRED_INVOKE_HEADERS = {
  FUNCTION_ARN: "lambda-runtime-invoked-function-arn",
  REQUEST_ID: "lambda-runtime-aws-request-id",
  DEADLINE_MS: "lambda-runtime-deadline-ms",
} as const;

export const OPTIONAL_INVOKE_HEADERS = {
  CLIENT_CONTEXT: "lambda-runtime-client-context",
  COGNITO_IDENTITY: "lambda-runtime-cognito-identity",
  X_RAY_TRACE_ID: "lambda-runtime-trace-id",
  TENANT_ID: "lambda-runtime-aws-tenant-id",
} as const;

export const HEADERS = {
  ...REQUIRED_INVOKE_HEADERS,
  ...OPTIONAL_INVOKE_HEADERS,
} as const;

export const REQUIRED_ENV_VARS = [
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_LAMBDA_FUNCTION_VERSION",
  "AWS_LAMBDA_FUNCTION_MEMORY_SIZE",
  "AWS_LAMBDA_LOG_GROUP_NAME",
  "AWS_LAMBDA_LOG_STREAM_NAME",
];

// This RIC is used by Nodejs24 and above, it's used by NOdejs22 only for LMI and not OD
export const CALLBACK_ERROR_NODEJS22 =
  "ERROR: AWS Lambda does not support callback-based function handlers when using Node.js 22 with Managed Instances. To use Managed Instances, modify this function to use a supported handler signature. For more information see https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html.";

export const CALLBACK_ERROR_NODEJS24_ABOVE =
  "ERROR: AWS Lambda has removed support for callback-based function handlers starting with Node.js 24. You need to modify this function to use a supported handler signature to use Node.js 24 or later. For more information see https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html.";
