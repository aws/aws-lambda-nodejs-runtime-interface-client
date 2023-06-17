'use strict';

import { run } from 'aws-lambda-ric';

const echo = async (event, context) => {
  console.log('hello world');
  return 'success';
};

await run(echo);
