/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

import { getMessage } from './cjsModule.cjs';

export const handler = async (_event) => {
    return getMessage();
};
