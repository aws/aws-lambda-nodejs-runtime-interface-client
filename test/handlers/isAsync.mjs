/** Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

export const handlerAsync = async () => {
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};

export const handlerNotAsync = () => {
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};