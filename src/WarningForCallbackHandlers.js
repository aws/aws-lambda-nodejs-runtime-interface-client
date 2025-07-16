/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const shouldWarnOnCallbackFunctionUse = (metadata) => {
  return (
    process.env.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING === undefined &&
    metadata !== undefined &&
    metadata.argsNum == 3 &&
    metadata.isAsync == false &&
    metadata.streaming == false
  );
};

module.exports.checkForDeprecatedCallback = function (metadata) {
  if (shouldWarnOnCallbackFunctionUse(metadata)) {
    console.warn(
      `AWS Lambda plans to remove support for callback-based function handlers starting with Node.js 24. You will need to update this function to use an async handler to use Node.js 24 or later. For more information and to provide feedback on this change, see https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/issues/137. To disable this warning, set the AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING environment variable.`,
    );
  }
};