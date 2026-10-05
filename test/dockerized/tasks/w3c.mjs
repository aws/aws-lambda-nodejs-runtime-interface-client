// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//

export const getW3c = async (_event, context) => {
  return context.w3c();
};

export const getW3cAndSource = async (_event, context) => {
  const clientContext = context.clientContext;
  return {
    w3c: context.w3c(),
    clientContextIsDefined: clientContext !== undefined,
    clientContextHasW3c: clientContext !== undefined && "w3c" in clientContext,
    clientContext: clientContext ?? null,
  };
};

export const echoClientContext = async (_event, context) => {
  return context.clientContext ?? null;
};

export const w3cShape = async (_event, context) => {
  const value = context.w3c();
  return {
    typeofW3c: typeof context.w3c,
    typeofResult: typeof value,
    isFrozen: Object.isFrozen(value),
    isObject: value !== null && typeof value === "object",
  };
};
