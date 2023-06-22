/** Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved. */
let awaited = false;

class AsyncInitRejectionException extends Error {
  constructor(msg) {
    super(msg);
    this.name = this.constructor.name;
  }
}

awaited = await new Promise((_, reject) =>
  setTimeout(
    () =>
      reject(
        new AsyncInitRejectionException('Oh noes! something bad happened'),
      ),
    900,
  ),
);

export const handler = async () => {
  if (!awaited) {
    throw new Error('The async initialization of this module was not awaited!');
  }
  return 'Hi';
};
