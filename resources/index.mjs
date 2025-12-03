export const handler = async (event) => {
  console.log("event: ", event);
  return {
    message: "Hello World",
    receivedEvent: event,
    processedAt: new Date().toISOString(),
  };
};
