import {defineConfig} from 'cypress';

export default defineConfig({

  e2e: {
    'baseUrl': 'http://localhost:8080',
    experimentalStudio: true,
    supportFile: 'test/cypress/support/e2e.ts',
    specPattern:'test/cypress/e2e/**/*.cy.ts',
    fixturesFolder:false,
    screenshotsFolder:'test/cypress/screenshots',
    downloadsFolder:'test/cypress/downloads',
  },

  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.ts'
  }

});
