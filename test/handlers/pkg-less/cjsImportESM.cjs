/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

'use strict';

// This static import is not allowed in CJS
import { getMessage } from './esmModule';

module.exports.handler = async () => {
    return getMessage();
};
