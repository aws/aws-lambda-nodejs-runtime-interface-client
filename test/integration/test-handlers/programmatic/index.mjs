'use strict';

import { start } from 'aws-lambda-ric';

const echo = async (event, context) => {
  console.log('hello world');
  return 'success';
};

await start(echo);
