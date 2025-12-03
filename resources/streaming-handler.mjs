/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const encoder = new TextEncoder();

    try {
      for (let i = 1; i <= 10; i++) {
        // Convert number to string and add newline
        const data = `${i}\n`;
        // Write to stream
        await responseStream.write(data);
        // Wait for 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      responseStream.write("hello\n");
    } finally {
      await writer.close();
    }
  },
);
