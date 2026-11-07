import {NextFunction, Request, Response} from 'express';
import {Config} from '../../common/config/private/Config';

export class ServerTimeEntry {
  public name: string;
  startHR?: [number, number];
  public endTime: number | null = null;

  constructor(name: string) {
    this.name = name;
  }

  public start(): void {
    this.startHR = process.hrtime();
  }

  public end(): number {
    const duration = process.hrtime(this.startHR);
    this.endTime = duration[0] * 1e3 + duration[1] * 1e-6;
    return this.endTime;
  }
}

export const FunctionTime = (id: string, name: string) => {
  return <A extends unknown[], R>(
    target: unknown,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: A) => R>
  ): void => {
    if (Config.Server.Log.logServerTiming === false) {
      return;
    }
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      return;
    }

    descriptor.value = function (this: unknown, ...args: A): R {
      const timer = new ServerTimeEntry(name);
      timer.start();

      try {
        const result = originalMethod.apply(this, args);

        // Handle both sync and async functions
        if (result instanceof Promise) {
          // Async function - return a promise that logs timing when resolved
          return result
            .then((value: unknown) => {
              const time = timer.end();
              console.log(`[${id}] ${name}: ${time.toFixed(2)}ms`);
              return value;
            })
            .catch((error: unknown) => {
              const time = timer.end();
              console.log(`[${id}] ${name}: ${time.toFixed(2)}ms (error)`);
              throw error;
            }) as R;
        } else {
          // Sync function - log timing immediately
          const time = timer.end();
          console.log(`[${id}] ${name}: ${time.toFixed(2)}ms`);
          return result;
        }
      } catch (error) {
        const time = timer.end();
        console.log(`[${id}] ${name}: ${time.toFixed(2)}ms (error)`);
        throw error;
      }
    };
  };
};

export const ServerTime = (id: string, name: string) => {
  return <T extends (req: Request, res: Response, next: NextFunction) => void | Promise<void>>(
      target: unknown,
      propertyName: string,
      descriptor: TypedPropertyDescriptor<T>
  ): void => {
    if (Config.Server.Log.logServerTiming === false) {
      return;
    }
    const m = descriptor.value;
    if (!m) {
      return;
    }
    const customAction = (req: Request, res: Response, next: NextFunction) => {
      req.timing = req.timing || {};
      const entry = new ServerTimeEntry(name);
      req.timing[id] = entry;
      entry.start();
      m(req, res, (err?: unknown) => {
        entry.end();
        next(err);
      });
    };
    descriptor.value = new Function(
        'action',
        'return function ' + m.name + '(...args){ action(...args) };'
    )(customAction);
  };
};

const forcedDebug = process.env['NODE_ENV'] === 'debug';

export class ServerTimingMWs {
  /**
   * Add server timing
   */
  public static async addServerTiming(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (
        (Config.Server.Log.logServerTiming === false && !forcedDebug) ||
        !req.timing
    ) {
      return next();
    }
    const l = Object.entries(req.timing)
        .filter((e) => e[1].endTime)
        .map((e) => `${e[0]};dur=${e[1].endTime};desc="${e[1].name}"`);
    res.header('Server-Timing', l.join(', '));
    next();
  }
}
