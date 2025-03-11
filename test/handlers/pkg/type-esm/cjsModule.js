/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

'use strict';

// This should fail because it's CJS syntax in a ESM context
module.exports.handler = async (_event) => {
  return 'This should fail';
};
