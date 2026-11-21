import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {Logger} from '../../../src/backend/Logger';
import {Config} from '../../../src/common/config/private/Config';
import {LogLevel} from '../../../src/common/config/Enums';
import {TestHelper} from '../../TestHelper';

declare const describe: any;
declare const it: any;
declare const before: any;
declare const beforeEach: any;
declare const afterEach: any;

describe('Logger', () => {
  before(TestHelper.resetConfig);

  const dir = path.join(TestHelper.TMP_DIR, 'logger');
  const logFile = path.join(dir, 'logs', 'pigallery2.log');
  const origConsole = {log: console.log, warn: console.warn, error: console.error, debug: console.debug};
  const origLimit = Logger.fileSizeLimit;

  beforeEach(() => {
    fs.rmSync(dir, {recursive: true, force: true});
    // keep the test output clean
    console.log = console.warn = console.error = console.debug = (): void => undefined;
    Config.Server.Log.level = LogLevel.info;
  });

  afterEach(() => {
    Object.assign(console, origConsole);
    Config.Server.Log.file = '';
    Logger.fileSizeLimit = origLimit;
    Logger.closeFile();
    fs.rmSync(dir, {recursive: true, force: true});
  });

  const readLines = (file = logFile): string[] =>
    fs.readFileSync(file, 'utf8').split('\n').filter(l => l !== '');

  it('should not write a file by default', () => {
    Logger.warn('AuthenticationMWs', 'Failed login');
    expect(Config.Server.Log.file).to.equal('');
    expect(fs.existsSync(dir)).to.be.false;
  });

  it('should write plain lines with an ISO timestamp to the file, creating its folder', () => {
    Config.Server.Log.file = logFile;
    Logger.warn('AuthenticationMWs', 'Failed login from IP `203.0.113.7` for user:"bob"', {a: 1});
    Logger.info('[Job]', 'started');

    const lines = readLines();
    expect(lines).to.have.length(2);
    expect(lines[0]).to.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z \[WARN_] AuthenticationMWs Failed login from IP `203\.0\.113\.7` for user:"bob" \{ a: 1 }$/);
    expect(lines[1]).to.match(/Z \[INFO_]\[Job] started$/);
    expect(fs.readFileSync(logFile, 'utf8')).to.not.include('\x1b');
  });

  it('should follow the log level', () => {
    Config.Server.Log.file = logFile;
    Logger.debug('not written');
    Logger.error('written');
    const lines = readLines();
    expect(lines).to.have.length(1);
    expect(lines[0]).to.include('[ERROR] written');
  });

  it('should keep one old file when the file gets too big', () => {
    Config.Server.Log.file = logFile;
    Logger.fileSizeLimit = 100;
    Logger.warn('first', 'x'.repeat(80));
    Logger.warn('second', 'x'.repeat(80));
    Logger.warn('third');

    expect(readLines(logFile + '.1')).to.have.length(1);
    expect(readLines(logFile + '.1')[0]).to.include('second');
    expect(readLines()).to.have.length(1);
    expect(readLines()[0]).to.include('third');
  });

  it('should switch to a new file when the setting changes', () => {
    Config.Server.Log.file = logFile;
    Logger.warn('one');
    const other = path.join(dir, 'other.log');
    Config.Server.Log.file = other;
    Logger.warn('two');

    expect(readLines()).to.have.length(1);
    expect(readLines(other)).to.have.length(1);
    expect(readLines(other)[0]).to.include('two');
  });

  it('should keep logging to the console if the file can\'t be written', () => {
    let printed = 0;
    console.warn = (): void => {
      printed++;
    };
    fs.mkdirSync(logFile, {recursive: true}); // a folder at the file's path
    Config.Server.Log.file = logFile;
    Logger.warn('one');
    Logger.warn('two');
    expect(printed).to.equal(2);
  });
});
