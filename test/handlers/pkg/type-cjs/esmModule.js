/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

// This should fail because it's ESM syntax in a CJS context
export const handler = async (_event) => {
  return 'This should fail';
};
