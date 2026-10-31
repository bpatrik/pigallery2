// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

// Containers (e.g. cloud agent sessions) often have no system Chrome, only Playwright's Chromium.
if (!process.env.CHROME_BIN) {
  try {
    process.env.CHROME_BIN = require('playwright').chromium.executablePath();
  } catch (e) {
    // no Playwright: karma-chrome-launcher looks for a system Chrome
  }
}
// Chrome refuses to start its sandbox as root (e.g. in Docker / cloud containers)
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      // own folder: nyc writes the backend report into coverage/
      dir: require('path').join(__dirname, 'coverage', 'frontend'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'lcovonly' },
        { type: 'text-summary' }
      ]
    },
    // dots: compact output when not on a terminal (CI, coding agents)
    reporters: [process.stdout.isTTY ? 'progress' : 'dots', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    },
    browsers: [isRoot ? 'ChromeHeadlessNoSandbox' : 'ChromeHeadless'],
    singleRun: true
  });
};
