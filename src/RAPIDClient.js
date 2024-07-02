/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module defines the RAPID client which is responsible for all HTTP
 * interactions with the RAPID layer.
 */

'use strict';

const Errors = require('./Errors');
const XRayError = require('./XRayError');
const ERROR_TYPE_HEADER = 'Lambda-Runtime-Function-Error-Type';
const { createResponseStream } = require('./ResponseStream');

/**
 * Objects of this class are responsible for all interactions with the RAPID
 * API.
 */
module.exports = class RAPIDClient {
  constructor(hostnamePort, httpClient, nativeClient) {
    this.http = httpClient || require('http');
    this.nativeClient =
      nativeClient || require('./NativeModuleLoader.js').load();
    this.useAlternativeClient =
      process.env['AWS_LAMBDA_NODEJS_USE_ALTERNATIVE_CLIENT_1'] === 'true';

    let [hostname, port] = hostnamePort.split(':');
    this.hostname = hostname;
    this.port = parseInt(port, 10);
    this.agent = new this.http.Agent({
      keepAlive: true,
      maxSockets: 1,
    });
  }

  /**
   * Complete and invocation with the provided response.
   * @param {Object} response
   *   An arbitrary object to convert to JSON and send back as as response.
   * @param {String} id
   *   The invocation ID.
   * @param {Function} callback
   *   The callback to run after the POST response ends
   */
  postInvocationResponse(response, id, callback) {
    let bodyString = _trySerializeResponse(response);
    this.nativeClient.done(encodeURIComponent(id), bodyString);
    callback();
  }

  /**
   * Stream the invocation response.
   * @param {String} id
   *   The invocation ID.
   * @param {Function} callback
   *   The callback to run after the POST response ends
   * @return {object}
   *   A response stream and a Promise that resolves when the stream is done.
   */
  getStreamForInvocationResponse(id, callback, options) {
    const ret = createResponseStream({
      httpOptions: {
        agent: this.agent,
        http: this.http,
        hostname: this.hostname,
        method: 'POST',
        port: this.port,
        path:
          '/2018-06-01/runtime/invocation/' +
          encodeURIComponent(id) +
          '/response',
        highWaterMark: options?.highWaterMark,
      },
    });

    return {
      request: ret.request,
      responseDone: ret.responseDone.then((_) => {
        if (callback) {
          callback();
        }
      }),
    };
  }

  /**
   * Post an initialization error to the RAPID API.
   * @param {Error} error
   * @param {Function} callback
   *   The callback to run after the POST response ends
   */
  postInitError(error, callback) {
    let response = Errors.toRapidResponse(error);
    this._post(
      `/2018-06-01/runtime/init/error`,
      response,
      { [ERROR_TYPE_HEADER]: response.errorType },
      callback,
    );
  }

  /**
   * Post an invocation error to the RAPID API
   * @param {Error} error
   * @param {String} id
   *   The invocation ID for the in-progress invocation.
   * @param {Function} callback
   *   The callback to run after the POST response ends
   */
  postInvocationError(error, id, callback) {
    let response = Errors.toRapidResponse(error);
    let bodyString = _trySerializeResponse(response);
    let xrayString = XRayError.formatted(error);
    this.nativeClient.error(encodeURIComponent(id), bodyString, xrayString);
    callback();
  }

  /**
   * Get the next invocation.
   * @return {PromiseLike.<Object>}
   *   A promise which resolves to an invocation object that contains the body
   *   as json and the header array. e.g. {bodyJson, headers}
   */
  async nextInvocation() {
    if (this.useAlternativeClient) {
      const options = {
        hostname: this.hostname,
        port: this.port,
        path: '/2018-06-01/runtime/invocation/next',
        method: 'GET',
        agent: this.agent,
      };
      return new Promise((resolve, reject) => {
        let request = this.http.request(options, (response) => {
          let data = '';
          response
            .setEncoding('utf-8')
            .on('data', (chunk) => {
              data += chunk;
            })
            .on('end', () => {
              resolve({
                bodyJson: data,
                headers: response.headers,
              });
            });
        });
        request
          .on('error', (e) => {
            reject(e);
          })
          .end();
      });
    }

    return this.nativeClient.next();
  }

  /**
   * HTTP Post to a path.
   * @param {String} path
   * @param {Object} body
   *   The body is serialized into JSON before posting.
   * @param {Object} headers
   *   The http headers
   * @param (function()} callback
   *   The callback to run after the POST response ends
   */
  _post(path, body, headers, callback) {
    let bodyString = _trySerializeResponse(body);
    const options = {
      hostname: this.hostname,
      port: this.port,
      path: path,
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.from(bodyString).length,
        },
        headers || {},
      ),
      agent: this.agent,
    };
    let request = this.http.request(options, (response) => {
      response
        .on('end', () => {
          callback();
        })
        .on('error', (e) => {
          throw e;
        })
        .on('data', () => {});
    });
    request
      .on('error', (e) => {
        throw e;
      })
      .end(bodyString, 'utf-8');
  }
};

/**
 * Attempt to serialize an object as json. Capture the failure if it occurs and
 * throw one that's known to be serializable.
 */
function _trySerializeResponse(body) {
  try {
    return JSON.stringify(body === undefined ? null : body);
  } catch (err) {
    throw new Error('Unable to stringify response body');
  }
}
