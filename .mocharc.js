module.exports = {
    timeout: 20000, // Set timeout to 20 seconds (good for slow test setups)
    // reflect-metadata: TypeORM reads the decorator metadata of the entities (src/backend/index.ts loads it for the app)
    // KnownFailures: lists the expectToFail() tests; OpenHandles: lists what keeps the process alive after the tests
    require: ['test/setup-local.js', 'reflect-metadata', 'test/backend/KnownFailures.js', 'test/backend/OpenHandles.js'],
    recursive: true, // Run tests in subdirectories
    exclude: ['test/folder-reset.js'],
  };
