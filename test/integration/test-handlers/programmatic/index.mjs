/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

import { run } from 'aws-lambda-ric';

const echo = async (event, context) => {
  console.log('hello world');
  return 'success';
};

await run(echo);
