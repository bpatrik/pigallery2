module.exports = {
    timeout: 20000, // Set timeout to 20 seconds (good for slow test setups)
    // reflect-metadata: TypeORM reads the decorator metadata of the entities (src/backend/index.ts loads it for the app)
    require: ['test/setup-local.js', 'reflect-metadata'],
    recursive: true, // Run tests in subdirectories
    exclude: ['test/cypress/**/*.js','test/folder-reset.js'],
  };
