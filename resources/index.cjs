exports.handler = async function(event, context) {
  console.log(`hello from ${context.awsRequestId}`)

  return {
    status: 200,
    body: event
  }
};
