import {Config} from '../common/config/private/Config';
import {LogLevel} from '../common/config/private/PrivateConfig';
import {ErrorCodes} from '../common/entities/Error';


const forcedDebug = process.env['NODE_ENV'] === 'debug';

if (forcedDebug === true) {
  console.log(
    'NODE_ENV environmental variable is set to debug, forcing all logs to print'
  );
}

export type LoggerArgs = (string | number | (() => string) | Record<any, unknown> | Error);
export type LoggerFunction = (...args: LoggerArgs[]) => void;

export interface ILogger {
  silly: LoggerFunction;
  debug: LoggerFunction;
  verbose: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

export const createLoggerWrapper = (TAG: string): ILogger => ({
  silly: (...args: LoggerArgs[]) => {
    Logger.silly(TAG, ...args);
  },
  debug: (...args: LoggerArgs[]) => {
    Logger.debug(TAG, ...args);
  },
  verbose: (...args: LoggerArgs[]) => {
    Logger.verbose(TAG, ...args);
  },
  info: (...args: LoggerArgs[]) => {
    Logger.info(TAG, ...args);
  },
  warn: (...args: LoggerArgs[]) => {
    Logger.warn(TAG, ...args);
  },
  error: (...args: LoggerArgs[]) => {
    Logger.error(TAG, ...args);
  }
});

export class Logger {
  public static silly(...args: LoggerArgs[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.silly) {
      return;
    }
    Logger.log(`[\x1b[35mSILLY\x1b[0m]`, ...args);
  }

  public static debug(...args: LoggerArgs[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.debug) {
      return;
    }
    Logger.log(`[\x1b[34mDEBUG\x1b[0m]`, ...args);
  }

  public static verbose(...args: LoggerArgs[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.verbose) {
      return;
    }
    Logger.log(`[\x1b[36mVERBS\x1b[0m]`, ...args);
  }

  public static info(...args: LoggerArgs[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.info) {
      return;
    }
    Logger.log(`[\x1b[32mINFO_\x1b[0m]`, ...args);
  }

  public static warn(...args: LoggerArgs[]): void {
    if (!forcedDebug && Config.Server.Log.level < LogLevel.warn) {
      return;
    }
    Logger.log(`[\x1b[33mWARN_\x1b[0m]`, ...args);
  }

  public static error(...args: LoggerArgs[]): void {
    Logger.log(`[\x1b[31mERROR\x1b[0m]`, ...args);
  }

  private static log(tag: string, ...args: LoggerArgs[]): void {
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
    args.forEach((element:LoggerArgs, index:number) => {
      if(typeof element === "function"){
        args[index] = element(); //execute function, put resulting string in the array
      }
    });
    console.log(date + tag + LOG_TAG, ...args);
  }

  public static logLevelForError(e: ErrorCodes): LoggerFunction {
    switch (e) {
      case ErrorCodes.INPUT_ERROR:
      case ErrorCodes.NOT_AUTHENTICATED:
      case ErrorCodes.ALREADY_AUTHENTICATED:
      case ErrorCodes.NOT_AUTHORISED:
      case ErrorCodes.PERMISSION_DENIED:
      case ErrorCodes.CREDENTIAL_NOT_FOUND:
        return Logger.debug
      case ErrorCodes.SETTINGS_ERROR:
      case ErrorCodes.TASK_ERROR:
      case ErrorCodes.JOB_ERROR:
      case ErrorCodes.THUMBNAIL_GENERATION_ERROR:
      case ErrorCodes.PHOTO_GENERATION_ERROR:
      case ErrorCodes.SERVER_ERROR:
        return Logger.error
      default:
        return Logger.warn
    }
  }
}
