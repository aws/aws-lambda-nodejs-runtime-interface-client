/** Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
let awaited = false;

awaited = await new Promise((resolve) => setTimeout(() => resolve(true), 900));

export const handler = async () => {
  if (!awaited) {
    throw new Error('The async initialization of this module was not awaited!');
  }
  return 'Hi';
};
