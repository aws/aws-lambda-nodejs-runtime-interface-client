/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */

'use strict';

const Mocha = require('mocha');
const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
} = Mocha.Runner.constants;

/**
 * Custom reporter does not depend on any of the console.* functions, which
 * enables clean test output even when applying the lambda-runtime console
 * patch.
 */
module.exports = class StdoutReporter {
  constructor(runner) {
    this._alreadyWritten = false;
    this._report = '';
    this._indents = 0;
    const stats = runner.stats;

    runner
      .once(EVENT_RUN_BEGIN, () => {})
      .on(EVENT_SUITE_BEGIN, (suite) => {
        this.log(suite.title);
        this.increaseIndent();
      })
      .on(EVENT_SUITE_END, () => {
        this.decreaseIndent();
      })
      .on(EVENT_TEST_PASS, (test) => {
        this.log(`✓ ${test.title}`);
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        this.log(`✗ ${test.title}`);
        this.increaseIndent();
        err.stack.split('\n').forEach((msg) => this.log(msg));
        this.decreaseIndent();
      })
      .once(EVENT_RUN_END, () => {
        this.log(
          'Results ' +
            stats.passes +
            ' passed out of ' +
            (stats.passes + stats.failures) +
            ' total tests',
        );
        this.dumpReport();
      });

    // This is hella nice if Mocha crashes for some reason
    // (which turns out is easy to do if you fool around with console.log)
    process.on('exit', () => this.dumpReport());
  }

  indent() {
    return Array(this._indents).join('  ');
  }

  increaseIndent() {
    this._indents++;
  }

  decreaseIndent() {
    this._indents--;
  }

  log(line) {
    this._report += `${this.indent()}${line}\n`;
  }

  dumpReport() {
    if (!this._alreadyWritten) {
      process.stdout.write(this._report);
      this._alreadyWritten = true;
    }
  }
};
