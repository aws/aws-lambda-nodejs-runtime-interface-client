const ric = require('aws-lambda-ric');

const echo = async (event, context) => {
  console.log('hello world');
  return 'success';
};

ric.run(echo);
