/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

import { someESMFunction } from './esmModule.js';  // ESM import

module.exports.handler = async (event) => {  // CJS export
    return someESMFunction(event);
};

export const esm = 'This is ESM syntax';  // ESM export
