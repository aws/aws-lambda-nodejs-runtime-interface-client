/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

const { getMessage } = require('./cjsModule.cjs')

export const handler = async (_event) => {
    return getMessage();
};
