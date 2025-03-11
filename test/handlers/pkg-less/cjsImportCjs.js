/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

'use strict';

const { getMessage } = require('./cjsModule.cjs')

exports.handler = async (_event) => {
  return getMessage();
}
