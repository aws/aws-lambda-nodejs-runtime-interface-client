/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

'use strict';

exports.workingDirectory = async () => process.cwd();

exports.echo = async (event) => {
  return event;
};

exports.ping = async (event) => {
  return {
    msg: `pong[${event['msg']}]`,
  };
};

exports.env = async () => {
  return process.env;
};

exports.clientContext = async (_, ctx) => {
  return ctx.clientContext;
};

exports.cognitoIdentity = async (_, _ctx) => {
  return context.identity;
};

exports.nodePathContainsMajorVersion = async () => {
  let majorVersion = process.version.match(/(\d+)/g)[0];
  let expectedNodeString = `node${majorVersion}`;
  let nodePath = process.env['NODE_PATH'];

  console.log(nodePath, 'should include', expectedNodeString);

  return {
    nodePathIncludesMajorVersion: nodePath.includes(expectedNodeString),
  };
};
