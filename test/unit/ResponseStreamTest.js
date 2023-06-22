/**
 * Copyright 2021-2023 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

require('should');
const ServerMock = require('mock-http-server');
const {
  createResponseStream,
  tryCallFail,
} = require('../../src/ResponseStream.js');
const { HttpResponseStream } = require('../../src/HttpResponseStream.js');
const { InvalidStreamingOperation } = require('../../src/Errors.js');
const { verbose, vverbose, vvverbose } = require('../../src/VerboseLog').logger(
  'TEST',
);
const Throttle = require('throttle');
const pipeline = require('util').promisify(require('stream').pipeline);
const { Readable } = require('stream');
const { Buffer } = require('buffer');
const http = require('http');

/**
 * Node.js 17 changed the default DNS resolution ordering from always prioritizing ipv4 to the ordering
 * returned by the DNS provider.  In some environments, this can result in `localhost` resolving to
 * an ipv6 address instead of ipv4 and a consequent failure to connect to the server.
 * Hence, using `127.0.0.1` in place of localhost.
 * ref: https://github.com/nodejs/node/pull/39987
 */
const HOSTNAME = '127.0.0.1';
const PATH = '/asd/efg';

const createStream = (port, options) => {
  const {
    request: stream,
    headersDone,
    responseDone: streamDone,
  } = createResponseStream({
    httpOptions: {
      hostname: HOSTNAME,
      port,
      path: PATH,
      method: options?.method || 'POST',
      http: options?.http || require('http'),
      agent: new http.Agent({
        // keepAlive: true,
        // maxSockets: 1,
      }),
    },
    contentType: options?.contentType,
  });

  return { stream, headersDone, streamDone };
};

const streamSpy = (name, stream) =>
  stream
    .on('end', () => verbose(name, 'ended'))
    .on('close', () => verbose(name, 'closed'))
    .on('finish', () => verbose(name, 'finished'))
    .on('drain', () => verbose(name, 'drained'))
    .on('error', () => verbose(name, 'errored'))
    .on('pause', () => verbose(name, 'paused'))
    .on('readable', () => verbose(name, 'readabled'))
    .on('resume', () => verbose(name, 'resumed'));

const assertStream = async (port, useStream) => {
  const { stream, headersDone, streamDone } = createStream(port);
  streamSpy('test stream', stream);

  vverbose('assertStream 1');
  await useStream(stream);
  vverbose('assertStream 2');

  // auto-close.
  stream.end();
  vverbose('assertStream 3');

  const info = await headersDone;
  vverbose('assertStream 4');

  const body = await streamDone;
  vverbose('assertStream 5');

  const response = {
    statusCode: info.statusCode,
    headers: info.headers,
    body,
  };
  vverbose('assertStream 6');
  return response;
};

const destroyConnections = (server) => {
  server.connections().forEach((c) => c.destroy());
};

describe('stream - throws uncaughtException', () => {
  const server = new ServerMock({ host: HOSTNAME, port: 0 });
  let originalListener;

  before(function (done) {
    server.start(done);
  });
  after(function () {
    process.addListener('uncaughtException', originalListener);
  });

  it('no end will timeout', function (done) {
    this.timeout(1000); //increase timeout.

    originalListener = process.listeners('uncaughtException').pop();
    process.removeListener('uncaughtException', originalListener);

    const { stream, streamDone } = createStream(server.getHttpPort());
    streamSpy('ender', stream);
    stream.setContentType('moon/dust');

    // Write to the stream, do not call .end
    stream.write(Buffer.from([1]));

    process.prependOnceListener('uncaughtException', (err) => {
      should(err).be.not.empty();
      err.code.should.be.equal('ECONNRESET');
    });

    setTimeout(() => {
      stream.writableFinished.should.be.false();
      stream.end();
      streamDone.then(() => {
        destroyConnections(server);
        server.stop(done);
      });
    }, 500);
  });
});

describe('stream/pipeline', function () {
  this.timeout(10000);

  const server = new ServerMock({ host: HOSTNAME, port: 0 });

  beforeEach(function (done) {
    server.start(done);
  });

  afterEach(function (done) {
    server.stop(done);
  });

  it('can pipeline', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('application/octet-stream');
    const input = Readable.from(Buffer.from('moon'));

    await pipeline(input, stream);
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].body.should.be.equal('moon');
  });

  it('can pipeline with throttle', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('application/octet-stream');
    const input = Readable.from(Buffer.from('moon '.repeat(1000)));

    await pipeline(input, new Throttle({ bps: 20000, chunkSize: 2 }), stream);
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].body.should.be.equal('moon '.repeat(1000));
  });

  it('can pipeline with throttle 2', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('application/octet-stream');
    const input = Readable.from(Buffer.from('moon'));

    await pipeline(input, new Throttle({ bps: 1, chunkSize: 1 }), stream);
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].body.should.be.equal('moon');
  });

  it('can pipeline generator function', async () => {
    async function* generateContent() {
      // Push 1 MiB of data in 1 KiB chunks
      for (let i = 1; i <= 100; i++) {
        yield (i % 10).toString().repeat(1024); // push 1 KiB to the stream
      }
    }

    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('application/octet-stream');

    const input = generateContent();

    await pipeline(input, stream);
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);

    let expected = '';
    for await (let s of generateContent()) {
      expected += s;
    }
    reqs[0].body.should.be.equal(expected);
  });
});

describe('stream', () => {
  const server = new ServerMock({ host: HOSTNAME, port: 0 });

  beforeEach(function (done) {
    server.start(done);
  });

  afterEach(function (done) {
    server.stop(done);
  });

  it('write returns true', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('application/octet-stream');

    const result = stream.write('moon');
    result.should.be.true();

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);

    reqs[0].body.should.be.equal('moon');
  });

  it('default content type', (done) => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.end(() => {
      streamDone.then(() => {
        const reqs = server.requests();
        reqs.length.should.be.equal(1);
        reqs[0].headers['content-type'].should.be.equal(
          'application/octet-stream',
        );
        reqs[0].headers[
          'lambda-runtime-function-response-mode'
        ].should.be.equal('streaming');

        done();
      });
    });
  });

  it('expect error trailer', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].headers['trailer'].should.be.equal(
      'Lambda-Runtime-Function-Error-Type, Lambda-Runtime-Function-Error-Body',
    );
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );
  });

  it('chunked encoding', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].headers['transfer-encoding'].should.be.equal('chunked');
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );
  });

  it("setContentType doesn't throw when constructed", async () => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('moon/dust');

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].headers['content-type'].should.be.equal('moon/dust');
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );
  });

  it('content type from options', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort(), {
      contentType: 'moon/dust',
    });

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].headers['content-type'].should.be.equal('moon/dust');
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );
  });

  it('override content type from options', async () => {
    const { stream, streamDone } = createStream(server.getHttpPort(), {
      contentType: 'moon/flake',
    });
    stream.setContentType('moon/dust');

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);
    reqs[0].headers['content-type'].should.be.equal('moon/dust');
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );
  });

  it('override content type, metadata prelude', async () => {
    let { stream, streamDone } = createStream(server.getHttpPort(), {
      contentType: 'moon/flake',
    });
    stream = HttpResponseStream.from(stream, {
      loc: 'mare\x00tranquillitatis',
    });

    stream.write('ABC');

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);

    reqs[0].headers['content-type'].should.be.equal(
      'application/vnd.awslambda.http-integration-response',
    );
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );

    // Null in the object value is escaped, prelude added followed by a null byte.
    reqs[0].body.should.be.equal(
      '{"loc":"mare\\u0000tranquillitatis"}\u0000\u0000\u0000\u0000\u0000\u0000\x00\u0000ABC',
    );
  });

  it('metadata prelude, do not use return value', async () => {
    let { stream, streamDone } = createStream(server.getHttpPort());

    // Ignore the return value.
    HttpResponseStream.from(stream, {
      loc: 'mare\x00tranquillitatis',
    });

    stream.write('ABC');

    await new Promise((r) => stream.end(r));
    await streamDone;

    const reqs = server.requests();
    reqs.length.should.be.equal(1);

    reqs[0].headers['content-type'].should.be.equal(
      'application/vnd.awslambda.http-integration-response',
    );
    reqs[0].headers['lambda-runtime-function-response-mode'].should.be.equal(
      'streaming',
    );

    // Null in the object value is escaped, prelude added followed by a null byte.
    reqs[0].body.should.be.equal(
      '{"loc":"mare\\u0000tranquillitatis"}\x00\x00\x00\x00\x00\x00\x00\x00ABC',
    );
  });

  it('setContentType throws after first write', (done) => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.write(Buffer.from(JSON.stringify({})));
    should(() => stream.setContentType('moon/trust')).throw({
      name: 'Runtime.InvalidStreamingOperation',
      message: 'Cannot set content-type, too late.',
    });
    stream.end(() => streamDone.then(() => done()));
  });

  it('setContentType throws after first write, non-default', (done) => {
    const { stream, streamDone } = createStream(server.getHttpPort());
    stream.setContentType('moon/dust');
    stream.write(Buffer.from([1, 2, 3, 2, 1]));
    should(() => stream.setContentType('moon/trust')).throw({
      name: 'Runtime.InvalidStreamingOperation',
      message: 'Cannot set content-type, too late.',
    });
    stream.end(() => streamDone.then(() => done()));
  });

  it('send error in trailer', (done) => {
    const { stream, streamDone } = createStream(server.getHttpPort(), {});
    tryCallFail(stream, 42);
    stream.end(() => {
      streamDone.then(() => {
        const reqs = server.requests();
        reqs.length.should.be.equal(1);
        reqs[0].trailers['lambda-runtime-function-error-type'].should.be.equal(
          'number',
        );
        const body = JSON.parse(
          Buffer.from(
            reqs[0].trailers['lambda-runtime-function-error-body'],
            'base64',
          ).toString(),
        );

        body.should.be.eql({
          errorType: 'number',
          errorMessage: '42',
          trace: [],
        });

        done();
      });
    });
  });

  it('send InvalidStreamingOperation in trailer', (done) => {
    const { stream, streamDone } = createStream(server.getHttpPort(), {});
    tryCallFail(
      stream,
      new InvalidStreamingOperation('Cannot set content-type, too late.'),
    );
    stream.end(() => {
      streamDone.then(() => {
        const reqs = server.requests();
        reqs.length.should.be.equal(1);
        reqs[0].trailers['lambda-runtime-function-error-type'].should.be.equal(
          'Runtime.InvalidStreamingOperation',
        );
        const body = JSON.parse(
          Buffer.from(
            reqs[0].trailers['lambda-runtime-function-error-body'],
            'base64',
          ).toString(),
        );

        body.errorType.should.be.equal('Runtime.InvalidStreamingOperation');
        body.errorMessage.should.be.equal('Cannot set content-type, too late.');
        body.trace.should.be.not.empty();

        done();
      });
    });
  });

  it('send error in trailer, callback from fail', (done) => {
    const { stream, streamDone } = createStream(server.getHttpPort(), {});
    tryCallFail(stream, 42, () => {
      streamDone.then(() => {
        const reqs = server.requests();
        reqs.length.should.be.equal(1);
        reqs[0].trailers['lambda-runtime-function-error-type'].should.be.equal(
          'number',
        );

        const body = JSON.parse(
          Buffer.from(
            reqs[0].trailers['lambda-runtime-function-error-body'],
            'base64',
          ).toString(),
        );

        body.should.be.eql({
          errorType: 'number',
          errorMessage: '42',
          trace: [],
        });

        done();
      });
    });
  });

  const TypeErrorMsg =
    'The "chunk" argument must be of type string or an instance of Buffer or Uint8Array. Received an instance of Object';
  [0, 1, 2, 100, 1000].forEach((repeat) => {
    [
      {
        name: 'object, should fail',
        value: { moon: 'dust' },
        error: { code: 'ERR_INVALID_ARG_TYPE', message: TypeErrorMsg },
      },
      {
        name: 'string',
        value: JSON.stringify({ moon: 'dust' }),
        expected: '{"moon":"dust"}',
      },
      {
        name: 'buffer',
        value: Buffer.from(JSON.stringify({ moon: 'dust' })),
        expected: '{"moon":"dust"}',
      },
      {
        name: 'Uint8Array',
        value: new TextEncoder().encode(JSON.stringify({ moon: 'dust' })),
        expected: '{"moon":"dust"}',
      },
    ].forEach((v) => {
      it(`write ${repeat} ${v.name}`, async () => {
        server.on({
          method: 'POST',
          path: PATH,
          reply: {
            status: 200,
            headers: { 'content-type': 'application/octet-stream' },
            body: (req) => {
              return req.body;
            },
          },
        });

        const response = await assertStream(server.getHttpPort(), (stream) => {
          stream.setContentType('moon/sparkle');
          for (let i = 1; i <= repeat; i++) {
            try {
              stream.write(v.value);
            } catch (err) {
              if (!v.error) {
                throw err;
              }

              if (v.error.code) {
                err.code.should.be.equal(v.error.code);
              }
              if (v.error.message) {
                err.message.should.be.equal(v.error.message);
              }
            }
          }
          stream.end();
        });

        vvverbose('response', response);
        response.statusCode.should.be.equal(200);

        if (v.error) {
          return;
        }
        const expected = v.expected.repeat(repeat);
        const body = response.body ? response.body.toString('utf-8') : '';

        body.should.be.equal(expected);
      });
    });
  });
});
