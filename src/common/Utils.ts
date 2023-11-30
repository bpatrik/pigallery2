export class Utils {
  static GUID(): string {
    const s4 = (): string =>
        Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);

    return s4() + s4() + '-' + s4() + s4();
  }

  static chunkArrays<T>(arr: T[], chunkSize: number): T[][] {
    const R = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      R.push(arr.slice(i, i + chunkSize));
    }
    return R;
  }

  static wait(time: number): Promise<unknown> {
    return new Promise((resolve): void => {
      setTimeout(resolve, time);
    });
  }

  static removeNullOrEmptyObj<T extends { [key: string]: any }>(obj: T): T {
    if (typeof obj !== 'object' || obj == null) {
      return obj;
    }

    const keys = Object.keys(obj);
    for (const key of keys) {
      if (obj[key] !== null && typeof obj[key] === 'object') {
        if (Utils.removeNullOrEmptyObj(obj[key])) {
          if (Object.keys(obj[key]).length === 0) {
            delete obj[key];
          }
        }
      } else if (obj[key] === null) {
        delete obj[key];
      }
    }
    return obj;
  }

  static clone<T>(object: T): T {
    return JSON.parse(JSON.stringify(object));
  }

  static shallowClone<T>(object: T): T {
    const c: any = {};
    for (const e of Object.entries(object)) {
      c[e[0]] = e[1];
    }
    return c;
  }

  static zeroPrefix(value: string | number, length: number): string {
    const ret = '00000' + value;
    return ret.substr(ret.length - length);
  }

  /**
   * Checks if the two input (let them be objects or arrays or just primitives) are equal
   */
  static equalsFilter(object: any, filter: any, skipProp: string[] = []): boolean {
    if (typeof filter !== 'object' || filter == null) {
      return object === filter;
    }
    if (!object) {
      return false;
    }

    if (Array.isArray(object) && object.length !== filter.length) {
      return false;
    }
    const keys = Object.keys(filter);
    for (const key of keys) {
      if (skipProp.includes(key)) {
        continue;
      }
      if (typeof filter[key] === 'object') {
        if (Utils.equalsFilter(object[key], filter[key], skipProp) === false) {
          return false;
        }
      } else if (object[key] !== filter[key]) {
        return false;
      }
    }

    return true;
  }

  static toIsoString(d: number | Date) {
    if (!(d instanceof Date)) {
      d = new Date(d);
    }
    return d.getUTCFullYear() + '-' + d.getUTCMonth() + '-' + d.getUTCDate();
  }


  static makeUTCMidnight(d: number | Date) {
    if (!(d instanceof Date)) {
      d = new Date(d);
    }
    d.setUTCHours(0);
    d.setUTCMinutes(0);
    d.setUTCSeconds(0);
    d.setUTCMilliseconds(0);

    return d;
  }

  static renderDataSize(size: number): string {
    const postFixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    while (size > 1000 && index < postFixes.length - 1) {
      size /= 1000;
      index++;
    }
    return size.toFixed(2) + postFixes[index];
  }

  static getUnique(arr: any[]) {
    return arr.filter((value, index, arr) => arr.indexOf(value) === index);
  }

  static createRange(from: number, to: number): Array<number> {
    const arr = new Array(to - from + 1);
    let c = to - from + 1;
    while (c--) {
      arr[c] = to--;
    }
    return arr;
  }

  public static canonizePath(path: string): string {
    return path
        .replace(new RegExp('\\\\', 'g'), '/')
        .replace(new RegExp('/+', 'g'), '/');
  }

  static concatUrls(...args: string[]): string {
    let url = '';
    for (const item of args) {
      if (item === '' || typeof item === 'undefined') {
        continue;
      }

      const part = item.replace(new RegExp('\\\\', 'g'), '/');
      if (part === '/' || part === './') {
        continue;
      }

      url += part + '/';
    }
    url = url.replace(/(https?:\/\/)|(\/){2,}/g, '$1$2');

    if (url.trim() === '') {
      url = './';
    }

    return url.substring(0, url.length - 1);
  }

  public static updateKeys(targetObject: any, sourceObject: any): void {
    Object.keys(sourceObject).forEach((key): void => {
      if (typeof targetObject[key] === 'undefined') {
        return;
      }
      if (typeof targetObject[key] === 'object') {
        Utils.updateKeys(targetObject[key], sourceObject[key]);
      } else {
        targetObject[key] = sourceObject[key];
      }
    });
  }

  public static setKeys(targetObject: any, sourceObject: any): void {
    Object.keys(sourceObject).forEach((key): void => {
      if (typeof targetObject[key] === 'object') {
        Utils.setKeys(targetObject[key], sourceObject[key]);
      } else {
        targetObject[key] = sourceObject[key];
      }
    });
  }

  public static setKeysForced(targetObject: any, sourceObject: any): void {
    Object.keys(sourceObject).forEach((key): void => {
      if (typeof sourceObject[key] === 'object') {
        if (typeof targetObject[key] === 'undefined') {
          targetObject[key] = {};
        }
        Utils.setKeysForced(targetObject[key], sourceObject[key]);
      } else {
        targetObject[key] = sourceObject[key];
      }
    });
  }

  public static isValidEnumInt(EnumType: any, value: number) {
    return typeof EnumType[value] === 'string';
  }

  public static enumToArray(EnumType: any): { key: number; value: string }[] {
    const arr: Array<{ key: number; value: string }> = [];
    for (const enumMember in EnumType) {
      // eslint-disable-next-line no-prototype-builtins
      if (!EnumType.hasOwnProperty(enumMember)) {
        continue;
      }
      const key = parseInt(enumMember, 10);
      if (key >= 0) {
        arr.push({key, value: EnumType[enumMember]});
      }
    }
    return arr;
  }

  public static findClosest(num: number, arr: number[]): number {
    let curr = arr[0];
    let diff = Math.abs(num - curr);

    arr.forEach((value): void => {
      const newDiff = Math.abs(num - value);

      if (newDiff < diff) {
        diff = newDiff;
        curr = value;
      }
    });

    return curr;
  }

  public static findClosestinSorted(num: number, arr: number[]): number {
    let curr = arr[0];
    let diff = Math.abs(num - curr);
    for (const item of arr) {
      const newDiff = Math.abs(num - item);
      if (newDiff > diff) {
        break;
      }
      diff = newDiff;
      curr = item;
    }

    return curr;
  }

  public static isUInt32(value: number, max = 4294967295): boolean {
    value = parseInt('' + value, 10);
    return !isNaN(value) && value >= 0 && value <= max;
  }

  public static isInt32(value: number): boolean {
    value = parseFloat('' + value);
    return !isNaN(value) && value >= -2147483648 && value <= 2147483647;
  }

  public static isFloat32(value: number): boolean {
    const E = Math.pow(10, 38);
    const nE = Math.pow(10, -38);
    return (
        !isNaN(value) &&
        ((value >= -3.402823466 * E && value <= -1.175494351 * nE) ||
            (value <= 3.402823466 * E && value >= 1.175494351 * nE))
    );
  }

  public static getAnyX(num: number, arr: any[], start = 0): any[][] {
    if (num <= 0 || num > arr.length || start >= arr.length) {
      return [];
    }
    if (num <= 1) {
      return arr.slice(start).map((e): any[] => [e]);
    }
    if (num === arr.length - start) {
      return [arr.slice(start)];
    }
    const ret: any[][] = [];
    for (let i = start; i < arr.length; ++i) {
      Utils.getAnyX(num - 1, arr, i + 1).forEach((a): void => {
        a.push(arr[i]);
        ret.push(a);
      });
    }
    return ret;
  }

  public static collect<TItem, TRet>(iter: Iterator<TItem, TRet>) {
    const values: TItem[] = [];
    let nextValue = iter.next();

    while (!nextValue.done) {
        values.push(nextValue.value as TItem);
        nextValue = iter.next();
    }

    return [values, nextValue.value as TRet] as const;
}
}

export class LRU<V> {
  data: { [key: string]: { value: V; usage: number } } = {};

  constructor(public readonly size: number) {
  }

  set(key: string, value: V): void {
    this.data[key] = {usage: Date.now(), value};
    if (Object.keys(this.data).length > this.size) {
      let oldestK = key;
      let oldest = this.data[oldestK].usage;
      for (const k in this.data) {
        if (this.data[k].usage < oldest) {
          oldestK = k;
          oldest = this.data[oldestK].usage;
        }
      }
      delete this.data[oldestK];
    }
  }

  get(key: string): V {
    if (!this.data[key]) {
      return;
    }
    return this.data[key].value;
  }
}
