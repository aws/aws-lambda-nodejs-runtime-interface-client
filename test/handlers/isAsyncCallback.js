/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

'use strict';

exports.handler = (_event, _context, callback) => {
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      message: 'hello world',
    }),
  });
};