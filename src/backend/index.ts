// TypeORM reads the decorator metadata of the entities, so load the polyfill before any of them
import 'reflect-metadata';
import {Server} from './server';
import {ConfigDiagnostics} from './model/diagnostics/ConfigDiagnostics';


if ((process.argv || []).includes('--run-diagnostics')) {
  console.log('Running diagnostics and exiting.');
  ConfigDiagnostics.runDiagnostics().catch((e) => {
    console.error(e);
    process.exit(1);
  }).then(() => {
    process.exit(0);
  });
} else {
  Server.getInstance();
}
