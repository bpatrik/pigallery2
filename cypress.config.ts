import {defineConfig} from 'cypress';

export default defineConfig({

  e2e: {
    'baseUrl': 'http://localhost:8080',
    supportFile: 'test/cypress/support/e2e.ts',
    specPattern:'test/cypress/e2e/**/*.cy.ts',
    fixturesFolder:false,
    screenshotsFolder:'test/cypress/screenshots',
    downloadsFolder:'test/cypress/downloads',
  },

});
