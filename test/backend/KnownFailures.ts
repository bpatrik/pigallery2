import * as chai from 'chai';

/**
 * Tests of behaviour that doesn't work yet (mocha has no test.fail()).
 * expectToFail() passes while its check fails on an assertion, and fails once the check passes,
 * so the wrapper can't be forgotten after the fix. The root hooks below list every known failure
 * after the run; CI counts them in the job summary (see build.yml).
 */

interface KnownFailure {
  title: string;
  issue: string;
}

const knownFailures: KnownFailure[] = [];
let issuesOfCurrentTest: string[] = [];

/**
 * @param issue the GitHub issue of the fix, e.g. '#1305'
 * @param check the assertions of the intended behaviour
 * @param message the assertion error the check fails with today; pin it when the check has several
 *                assertions, so a half fix doesn't keep the test green
 */
export const expectToFail = async (issue: string, check: () => unknown, message?: RegExp): Promise<void> => {
  try {
    await check();
  } catch (e) {
    if (!(e instanceof chai.AssertionError)) {
      throw e;
    }
    if (message && !message.test(e.message)) {
      throw new chai.AssertionError(`Known failure ${issue} failed on another assertion than ${message}: ${e.message}`);
    }
    issuesOfCurrentTest.push(issue);
    return;
  }
  throw new chai.AssertionError(`Known failure ${issue} passes now: remove its expectToFail() wrapper`);
};

export const mochaHooks = {
  beforeEach(): void {
    issuesOfCurrentTest = [];
  },
  afterEach(this: Mocha.Context): void {
    if (this.currentTest?.state !== 'passed') {
      return;
    }
    for (const issue of issuesOfCurrentTest) {
      knownFailures.push({title: this.currentTest.fullTitle(), issue});
    }
  },
  afterAll(): void {
    if (knownFailures.length === 0) {
      return;
    }
    console.log('\n  Known failures (expectToFail):');
    for (const f of knownFailures) {
      console.log(`    ${f.issue} ${f.title}`);
    }
    // build.yml reads this line
    console.log(`  Known failures: ${knownFailures.length}\n`);
  }
};
