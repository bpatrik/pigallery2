import * as os from 'node:os';

process.env['UV_THREADPOOL_SIZE'] ??= String(os.availableParallelism());