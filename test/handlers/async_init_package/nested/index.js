/** Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

await new Promise((r) => setTimeout(r, 100));

export const handler = async () => {
  return 42;
};
