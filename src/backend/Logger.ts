import {Config} from '../common/config/private/Config';
import {LogLevel} from '../common/config/private/PrivateConfig';

export type logFN = (...args: (string | number)[]) => void;

const forcedDebug = process.env['NODE_ENV'] === 'debug';

if (forcedDebug === true) {
  console.log(
    'NODE_ENV environmental variable is set to debug, forcing all logs to print'
  );
}

export type LoggerFunction = (...args: (string | number)[]) => void;

export interface ILogger {
  silly: LoggerFunction;
  debug: LoggerFunction;
  verbose: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

export const createLoggerWrapper = (TAG: string): ILogger => ({
  silly: (...args: (string | number)[]) => {
    Logger.silly(TAG, ...args);
  },
  debug: (...args: (string | number)[]) => {
    Logger.debug(TAG, ...args);
  },
  verbose: (...args: (string | number)[]) => {
    Logger.verbose(TAG, ...args);
  },
  info: (...args: (string | number)[]) => {
    Logger.info(TAG, ...args);
  },
  warn: (...args: (string | number)[]) => {
    Logger.warn(TAG, ...args);
  },
  error: (...args: (string | number)[]) => {
    Logger.error(TAG, ...args);
  }
});

export class Logger {
  public static silly(...args: (string | number)[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.silly) {
      return;
    }
    Logger.log(`[\x1b[35mSILLY\x1b[0m]`, ...args);
  }

  public static debug(...args: (string | number)[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.debug) {
      return;
    }
    Logger.log(`[\x1b[34mDEBUG\x1b[0m]`, ...args);
  }

  public static verbose(...args: (string | number)[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.verbose) {
      return;
    }
    Logger.log(`[\x1b[36mVERBS\x1b[0m]`, ...args);
  }

  public static info(...args: (string | number)[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.info) {
      return;
    }
    Logger.log(`[\x1b[32mINFO_\x1b[0m]`, ...args);
  }

  public static warn(...args: (string | number)[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.warn) {
      return;
    }
    Logger.log(`[\x1b[33mWARN_\x1b[0m]`, ...args);
  }

  public static error(...args: (string | number)[]): void {
    Logger.log(`[\x1b[31mERROR\x1b[0m]`, ...args);
  }

  private static log(tag: string, ...args: (string | number)[]): void {
    const date = new Date().toLocaleString();
    let LOG_TAG = '';
    if (
      args.length > 0 &&
      typeof args[0] === 'string' &&
      args[0].startsWith('[') &&
      args[0].endsWith(']')
    ) {
      LOG_TAG = args[0];
      args.shift();
    }
    console.log(date + tag + LOG_TAG, ...args);
  }
}
