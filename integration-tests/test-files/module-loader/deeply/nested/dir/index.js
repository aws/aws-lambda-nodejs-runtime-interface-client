export const handler = () => {
  return "Hello from index.js";
};

export const notAFunction = 42;

export const nested = {
  deeper: {
    handler: () => "Hello from nested.deeper.handler",
  },
};
