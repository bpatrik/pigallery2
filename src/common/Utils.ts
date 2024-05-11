import { HTMLChar } from './HTMLCharCodes';

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
      } else if (obj[key] === null || obj[key] === undefined) {
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

  static zeroPrefix(number: any, length: number): string {
    if (!isNaN(number)) {
      const zerosToAdd = Math.max(length - String(number).length, 0);
      return '0'.repeat(zerosToAdd) + number;
    } else {
      return '0'.repeat(number);
    }
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

  static toIsoTimestampString(YYYYMMDD: string, hhmmss: string): string {
    if (YYYYMMDD && hhmmss) {
      // Regular expression to match YYYYMMDD format
      const dateRegex = /^(\d{4})(\d{2})(\d{2})$/;
      // Regular expression to match hhmmss+/-ohom format
      const timeRegex = /^(\d{2})(\d{2})(\d{2})([+-]\d{2})?(\d{2})?$/;
      const [, year, month, day] = YYYYMMDD.match(dateRegex);
      const [, hour, minute, second, offsetHour, offsetMinute] = hhmmss.match(timeRegex);
      const isoTimestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      if (offsetHour && offsetMinute) {
        return isoTimestamp + `${offsetHour}:${offsetMinute}`;
      } else {
        return isoTimestamp;
      }
    } else {
      return undefined;
    }
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

  static getUTCFullYear(d: number | Date, offset: string) {
    if (!(d instanceof Date)) {
      d = new Date(d);
    }
    return new Date(new Date(d).toISOString().substring(0,19) + (offset ? offset : '')).getUTCFullYear();
  }

  static getFullYear(d: number | Date, offset: string) {
    if (!(d instanceof Date)) {
      d = new Date(d);
    }
    return new Date(new Date(d).toISOString().substring(0,19) + (offset ? offset : '')).getFullYear();
  }

  //function to convert timestamp into milliseconds taking offset into account
  static timestampToMS(timestamp: string, offset: string): number {
    if (!timestamp) {
      return undefined;
    }
    //replace : with - in the yyyy-mm-dd part of the timestamp.
    let formattedTimestamp = timestamp.substring(0,9).replaceAll(':', '-') + timestamp.substring(9,timestamp.length);
    if (formattedTimestamp.indexOf("Z") > 0) { //replace Z (and what comes after the Z) with offset
      formattedTimestamp = formattedTimestamp.substring(0, formattedTimestamp.indexOf("Z")) + (offset ? offset : '+00:00');
    } else if (formattedTimestamp.indexOf("+") > 0 || timestamp.substring(9,timestamp.length).indexOf("-") > 0) { //don't do anything
    } else { //add offset
      formattedTimestamp = formattedTimestamp + (offset ? offset : '+00:00');
    }
    //parse into MS and return
    return Date.parse(formattedTimestamp);
  }

  static splitTimestampAndOffset(timestamp: string): [string|undefined, string|undefined] {
    if (!timestamp) {
      return [undefined, undefined];
    }
    //                                 |---------------------TIMESTAMP WITH OPTIONAL MILLISECONDS--------------------||-OPTIONAL TZONE--|
    //                                 |YYYY           MM           DD            HH         MM         SS (MS optio)||(timezone offset)|
    const timestampWithOffsetRegex = /^(\d{4}[-.: ]\d{2}[-.: ]\d{2}[-.: T]\d{2}[-.: ]\d{2}[-.: ]\d{2}(?:\.\d+)?)([+-]\d{2}:\d{2})?$/;
    const match = timestamp.match(timestampWithOffsetRegex);
    if (match) {
      return [match[1], match[2]]; //match[0] is the full string, not interested in that.
    } else {
      return [undefined, undefined];
    }
  }


  //function to calculate offset from exif.exif.gpsTimeStamp or exif.gps.GPSDateStamp + exif.gps.GPSTimestamp
  static getTimeOffsetByGPSStamp(timestamp: string, gpsTimeStamp: string, gps: any) {
    let UTCTimestamp = gpsTimeStamp;
    if (!UTCTimestamp &&
      gps &&
      gps.GPSDateStamp &&
      gps.GPSTimeStamp) { //else use exif.gps.GPS*Stamp if available
      //GPS timestamp is always UTC (+00:00)
      UTCTimestamp = gps.GPSDateStamp.replaceAll(':', '-') + " " + gps.GPSTimeStamp.map((num: any) => Utils.zeroPrefix(num ,2)).join(':');
    }
    if (UTCTimestamp && timestamp) {
      //offset in minutes is the difference between gps timestamp and given timestamp
      //to calculate this correctly, we have to work with the same offset
      const offsetMinutes: number = Math.round((Utils.timestampToMS(timestamp, '+00:00')- Utils.timestampToMS(UTCTimestamp, '+00:00')) / 1000 / 60);
      return Utils.getOffsetString(offsetMinutes);
    } else {
      return undefined;
    }
  }

  static getOffsetString(offsetMinutes: number) {
    if (-720 <= offsetMinutes && offsetMinutes <= 840) {
      //valid offset is within -12 and +14 hrs (https://en.wikipedia.org/wiki/List_of_UTC_offsets)
      return (offsetMinutes < 0 ? "-" : "+") +                              //leading +/-
        Utils.zeroPrefix(Math.trunc(Math.abs(offsetMinutes) / 60), 2) + ":" +        //zeropadded hours and ':'
        Utils.zeroPrefix((Math.abs(offsetMinutes) % 60), 2);                         //zeropadded minutes
    } else {
      return undefined;
    }
  }

  static getOffsetMinutes(offsetString: string) { //Convert offset string (+HH:MM or -HH:MM) into a minute value
    const regex = /^([+-](0[0-9]|1[0-4]):[0-5][0-9])$/;  //checks if offset is between -14:00 and +14:00.
                                                         //-12:00 is the lowest valid UTC-offset, but we allow down to -14 for efficiency
    if (regex.test(offsetString)) {
      const hhmm = offsetString.split(":");
      const hours = parseInt(hhmm[0]);
      return hours < 0 ? ((hours*60) - parseInt(hhmm[1])) : ((hours*60) + parseInt(hhmm[1]));
    } else {
      return undefined;
    }
  }

    static getLocalTimeMS(creationDate: number, creationDateOffset: string) {
    const offsetMinutes = Utils.getOffsetMinutes(creationDateOffset);
    return creationDate + (offsetMinutes ? (offsetMinutes * 60000) : 0);
  }
  
  static isLeapYear(year: number) {
    return (0 == year % 4) && (0 != year % 100) || (0 == year % 400)
  }

  static isDateFromLeapYear(date: Date) {
    return Utils.isLeapYear(date.getFullYear());
  }

  // Get Day of Year
  static getDayOfYear(date: Date) {
    //Day-number at the start of Jan to Dec. A month baseline
    const dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const mn = date.getMonth();
    let dayOfYear = dayCount[mn] + date.getDate(); //add the date to the month baseline
    if (mn > 1 && Utils.isLeapYear((date.getFullYear()))) {
      dayOfYear++; //Add an extra day for march to december (mn>1) on leap years
    }
    return dayOfYear;
  }

  //Adding months to a date differently from standard JS
  //this function makes sure that if date is the 31st and you add a month, you will get the last day of the next month
  //so adding or subtracting a month from 31st of march will give 30th of april or 28th of february respectively (29th on leap years).
  static addMonthToDate(date: Date, numMonths: number) {
    const result = new Date(date)
    const expectedMonth = ((date.getMonth() + numMonths) % 12 + 12) % 12; //inner %12 + 12 makes correct handling of negative months
    result.setMonth(result.getMonth() + numMonths);
    if (result.getMonth() !== expectedMonth) {
      result.setDate(0);
    }
    return result;
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

  public static asciiToUTF8(text: string): string {
    if (text) {
      return Buffer.from(text, 'ascii').toString('utf-8');
    } else {
      return text;
    }
  }



  public static decodeHTMLChars(text: string): string {
    if (text) {
      const newtext = text.replace(/&#([0-9]{1,3});/gi, function (match, numStr) {
        return String.fromCharCode(parseInt(numStr, 10));
      });
      return newtext.replace(/&[^;]+;/g, function (match) {
        const char = HTMLChar[match];
        return char ? char : match;
      });
    } else {
      return text;
    }
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

  public static xmpExifGpsCoordinateToDecimalDegrees(text: string): number {
    if (!text) {
      return undefined;
    }
    const parts = text.match(/^([0-9]+),([0-9.]+)([EWNS])$/);
    const degrees: number = parseInt(parts[1], 10);
    const minutes: number = parseFloat(parts[2]);
    const sign = (parts[3] === "N" || parts[3] === "E") ? 1 : -1;
    return (sign * (degrees + (minutes / 60.0)))
  }


  public static sortableFilename(filename: string): string {
    const lastDot = filename.lastIndexOf(".");

    // Avoid 0 as well as -1 to prevent empty names for extensionless dot-files
    if (lastDot > 0) {
      return filename.substring(0, lastDot);
    }

    // Fallback to the full name
    return filename;
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
