/* eslint-disable @typescript-eslint/no-unused-vars */

// 3 args - should error
export const callbackHandler = (event, context, callback) => {
  callback(null, "callback result");
};

// 4 args - should error
export const callbackHandlerWithExtra = (event, context, callback, _extra) => {
  callback(null, "callback result");
};
