/* eslint-disable @typescript-eslint/no-unused-vars */

// 1 arg - should not error
export const singleArgHandler = (_event) => {
  return "single arg result";
};

// 2 args - should not error
export const twoArgHandler = (_event, _context) => {
  return "two arg result";
};

// 0 args - should not error
export const noArgHandler = () => {
  return "no arg result";
};
