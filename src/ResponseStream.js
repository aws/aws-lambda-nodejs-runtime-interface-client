/**
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const { InvalidStreamingOperation, toRapidResponse } = require('./Errors.js');
const { verbose, vvverbose } = require('./VerboseLog.js').logger('STREAM');
const net = require('net');

const STATUS_READY = 'ready'; // request created, no data sent yet, can send more data.
const STATUS_WRITE_CALLED = 'write_called'; // .write called and request created.

const HEADER_RESPONSE_MODE = 'Lambda-Runtime-Function-Response-Mode';
const VALUE_STREAMING = 'streaming';
const TRAILER_NAME_ERROR_TYPE = 'Lambda-Runtime-Function-Error-Type';
const TRAILER_NAME_ERROR_BODY = 'Lambda-Runtime-Function-Error-Body';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

const failProps = new WeakMap();

function addFailWeakProp(req, fn) {
  failProps.set(req, fn);
}

function tryCallFail(req, err, callback) {
  const fail = failProps.get(req);
  if (typeof fail === 'function') {
    fail(err, callback);
    return true;
  }
  return false;
}

function writableStreamOnly(inner) {
  const fns = [
    // stream.Writable
    'cork',
    'destroy',
    'end',
    'uncork',
    'write',

    // EventEmitter
    'addListener',
    'emit',
    'eventNames',
    'getMaxListeners',
    'listenerCount',
    'listeners',
    'off',
    'on',
    'once',
    'prependListener',
    'prependOnceListener',
    'rawListeners',
    'removeAllListeners',
    'removeListener',
    'setMaxListeners',

    // AWS
    'setContentType',
  ];

  const propsReadWrite = ['destroyed', 'writable', '_onBeforeFirstWrite'];

  const propsReadOnly = [
    'writableFinished',
    'writableObjectMode',
    'writableBuffer',
    'writableEnded',
    'writableNeedDrain',
    'writableHighWaterMark',
    'writableCorked',
    'writableLength',
  ];

  const stream = Object.fromEntries(
    fns.map((fn) => {
      return [fn, inner[fn].bind(inner)];
    }),
  );

  Object.defineProperties(
    stream,
    Object.fromEntries(
      propsReadWrite.map((prop) => [
        prop,
        {
          get() {
            return inner[prop];
          },
          set(value) {
            inner[prop] = value;
          },
        },
      ]),
    ),
  );

  Object.defineProperties(
    stream,
    Object.fromEntries(
      propsReadOnly.map((prop) => [
        prop,
        {
          get() {
            return inner[prop];
          },
        },
      ]),
    ),
  );

  return stream;
}

// Wraps a "transport" that can accept data in chunks. Transport can
// be an HTTP/1.1 connection with chunking.
// WARN There is NO chunk fidelity, i.e. no guarantee that HTTP chunks
// will map to Stream write invocations 1-1.
function createResponseStream(options) {
  let status = STATUS_READY;
  let req = undefined;

  const headers = {
    [HEADER_RESPONSE_MODE]: VALUE_STREAMING,
    Trailer: [TRAILER_NAME_ERROR_TYPE, TRAILER_NAME_ERROR_BODY],
    'Content-Type': options.contentType
      ? options.contentType
      : DEFAULT_CONTENT_TYPE,
  };

  let responseDoneResolve;
  let responseDoneReject;
  let responseDonePromise = new Promise((resolve, reject) => {
    responseDoneResolve = resolve;
    responseDoneReject = reject;
  });

  let headersDoneResolve;
  let headersDoneReject;
  let headersDonePromise = new Promise((resolve, reject) => {
    headersDoneResolve = resolve;
    headersDoneReject = reject;
  });

  const agent = options.httpOptions.agent;
  agent.createConnection = (opts, connectionListener) => {
    return net.createConnection(
      {
        ...opts,
        highWaterMark: options?.httpOptions?.highWaterMark,
      },
      connectionListener,
    );
  };

  req = options.httpOptions.http.request(
    {
      http: options.httpOptions.http,
      contentType: options.httpOptions.contentType,
      method: options.httpOptions.method,
      hostname: options.httpOptions.hostname,
      port: options.httpOptions.port,
      path: options.httpOptions.path,
      headers,
      agent: agent,
    },
    (res) => {
      headersDoneResolve({
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
      });

      let buf = undefined;

      res.on('data', (chunk) => {
        buf = typeof buf === 'undefined' ? chunk : Buffer.concat([buf, chunk]);
      });

      res.on('aborted', (err) => {
        if (responseDoneReject) {
          responseDoneReject(err);
        }
        req.destroy(err);
      });

      res.on('end', () => {
        vvverbose('rapid response', buf ? buf.toString() : 'buf undefined');

        responseDoneResolve(buf);
      });
    },
  );

  req.on('error', (err) => {
    if (headersDoneReject) {
      headersDoneReject(err);
    }

    if (responseDoneReject) {
      responseDoneReject(err);
    }

    req.destroy(err);
  });

  const origEnd = req.end.bind(req);
  req.end = function (cb) {
    origEnd(cb);
  };

  req.setContentType = function (contentType) {
    if (status !== STATUS_READY) {
      throw new InvalidStreamingOperation('Cannot set content-type, too late.');
    }
    req.setHeader('Content-Type', contentType);
  };

  const origWrite = req.write.bind(req);
  req.write = function (chunk, encoding, callback) {
    vvverbose(
      'ResponseStream::write',
      chunk.length,
      'callback:',
      typeof callback,
    );

    if (
      typeof chunk !== 'string' &&
      !Buffer.isBuffer(chunk) &&
      chunk?.constructor !== Uint8Array
    ) {
      chunk = JSON.stringify(chunk);
    }

    if (
      status === STATUS_READY &&
      typeof this._onBeforeFirstWrite === 'function'
    ) {
      this._onBeforeFirstWrite((ch) => origWrite(ch));
    }

    // First write shall open the connection.
    const ret = origWrite(chunk, encoding, callback);

    vvverbose('ResponseStream::origWrite', ret);
    vvverbose('ResponseStream::write outputData len', this.outputData.length);
    vvverbose('ResponseStream::write outputSize', this.outputSize);

    if (status === STATUS_READY) {
      status = STATUS_WRITE_CALLED;
    }

    return ret;
  };

  const request = writableStreamOnly(req);

  // This will close the stream after sending the error.
  addFailWeakProp(request, function (err, callback) {
    verbose('ResponseStream::fail err:', err);

    const error = toRapidResponse(err);

    // Send error as trailers.
    req.addTrailers({
      [TRAILER_NAME_ERROR_TYPE]: error.errorType,
      [TRAILER_NAME_ERROR_BODY]: Buffer.from(JSON.stringify(error)).toString(
        'base64',
      ),
    });

    req.end(callback);
  });

  return {
    request,
    headersDone: headersDonePromise, // Not required to be awaited.
    responseDone: responseDonePromise,
  };
}

module.exports.createResponseStream = createResponseStream;
module.exports.tryCallFail = tryCallFail;
