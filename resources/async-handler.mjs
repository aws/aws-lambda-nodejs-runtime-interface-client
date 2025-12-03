export const handler = async (event, context) => {
  console.log(`Async Handler invoked with event:`, event);
  console.log(`Async Handler invoked with context:`, context);
  console.log("Starting 3s processing...");

  console.log(
    `Remaining time at start: ${context.getRemainingTimeInMillis()}ms`,
  );

  await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay

  console.log(`Remaining time at end: ${context.getRemainingTimeInMillis()}ms`);

  return {
    message: "Hello World",
    receivedEvent: event,
    processedAt: new Date().toISOString(),
  };
};
