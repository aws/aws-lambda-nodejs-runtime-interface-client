/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

require('should');
const { formatted } = require('lambda-runtime/XRayError.js');

describe('XRayFormattedCause', () => {
  it('should handle a basic error with stack trace', () => {
    const error = new Error('Something went wrong');
    error.name = 'CustomError';
    error.stack = `CustomError: Something went wrong
    at someFunction (/var/task/handler.js:10:15)`;

    const result = JSON.parse(formatted(error));
    result.should.have.property('working_directory').which.is.a.String();
    result.should.have.property('exceptions').with.length(1);
    result.exceptions[0].should.have.property('type', 'CustomError');
    result.exceptions[0].should.have.property(
      'message',
      'Something went wrong',
    );
    result.exceptions[0].stack.should.deepEqual([
      {
        path: '/var/task/handler.js',
        line: 10,
        label: 'someFunction',
      },
    ]);
    result.paths.should.deepEqual(['/var/task/handler.js']);
  });

  it('should handle an error without stack trace', () => {
    const error = new Error('No stack here');
    error.name = 'NoStackError';
    error.stack = null;

    const result = JSON.parse(formatted(error));
    result.exceptions[0].should.have.property('stack').with.length(0);
    result.paths.should.eql([]);
  });

  it('should handle multiple stack frames', () => {
    const error = new Error('Complex error');
    error.name = 'ComplexError';
    error.stack = `ComplexError: Complex error
    at firstFunction (/var/task/one.js:1:100)
    at secondFunction (/var/task/two.js:2:200)
    at /var/task/three.js:3:300`;

    const result = JSON.parse(formatted(error));
    result.exceptions[0].stack.should.deepEqual([
      { path: '/var/task/one.js', line: 1, label: 'firstFunction' },
      { path: '/var/task/two.js', line: 2, label: 'secondFunction' },
      { path: '/var/task/three.js', line: 3, label: 'anonymous' },
    ]);
    result.paths.should.eql([
      '/var/task/one.js',
      '/var/task/two.js',
      '/var/task/three.js',
    ]);
  });

  it('should encode invalid characters in name and message', () => {
    const error = new Error('\x7Fmessage');
    error.name = 'Name\x7F';

    error.stack = `Name\x7F: \x7Fmessage
    at anon (/var/task/bad.js:99:1)`;

    const result = JSON.parse(formatted(error));
    result.exceptions[0].type.should.equal('Name%7F');
    result.exceptions[0].message.should.equal('%7Fmessage');
  });

  it('should return empty string on circular reference', () => {
    class CircularError extends Error {
      constructor() {
        super('circular');
        this.name = 'CircularError';
        this.circular = this;
      }

      toString() {
        return 'CircularError: circular';
      }
    }

    const error = new CircularError();
    error.stack = `CircularError: circular
    at circularFunction (/var/task/circle.js:1:1)`;

    // Manually inject the circular object into a field that gets stringified
    const originalStack = error.stack;
    error.stack = {
      toString: () => {
        return originalStack;
      },
    };
    error.stack.circular = error.stack;

    const result = formatted(error);
    result.should.equal('');
  });
});
