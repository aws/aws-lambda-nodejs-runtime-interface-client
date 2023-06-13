/** Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

import { echo as esModuleEcho } from './esModule.mjs';
import * as util from 'util';
import { Buffer } from 'buffer';
import defaultExport from './defaultHandlerESM.mjs';

export const echo = async (event) => {
  // Use an arbitrary internal node module, with import star.
  console.log(util.format('can import node module: %s+%s', 'yes', 'yes'));

  // Use an arbitrary internal node module.
  console.log(Buffer.from('yes'));

  // Use an arbitrary default export.
  console.log(defaultExport());

  return esModuleEcho(event);
};
