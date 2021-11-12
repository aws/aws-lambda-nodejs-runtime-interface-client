/** Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved. */

"use strict";

import { MochaOptions, Runner, reporters } from "mocha";

const {
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_PASS,
  EVENT_TEST_FAIL,
} = Runner.constants;

/**
 * Custom reporter does not depend on any of the console.* functions, which
 * enables clean test output even when applying the lambda-runtime console
 * patch.
 */
module.exports = class StdoutReporter extends reporters.Base {
  #alreadyWritten: boolean;
  #report: string;
  #indents: number;

  constructor(runner: Runner, options: MochaOptions) {
    super(runner, options);

    this.#alreadyWritten = false;
    this.#report = "";
    this.#indents = 0;
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
        err.stack.split("\n").forEach((msg) => this.log(msg));
        this.decreaseIndent();
      })
      .once(EVENT_RUN_END, () => {
        this.log(
          "Results " +
            stats.passes +
            " passed out of " +
            (stats.passes + stats.failures) +
            " total tests"
        );
        this.dumpReport();
      });

    // This is hella nice if Mocha crashes for some reason
    // (which turns out is easy to do if you fool around with console.log)
    process.on("exit", () => this.dumpReport());
  }

  indent() {
    return Array(this.#indents).join("  ");
  }

  increaseIndent() {
    this.#indents++;
  }

  decreaseIndent() {
    this.#indents--;
  }

  log(line) {
    this.#report += `${this.indent()}${line}\n`;
  }

  dumpReport() {
    if (!this.#alreadyWritten) {
      process.stdout.write(this.#report);
      this.#alreadyWritten = true;
    }
  }
};
