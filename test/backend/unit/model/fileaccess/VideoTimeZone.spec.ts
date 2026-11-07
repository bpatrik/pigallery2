import {expect} from 'chai';
import {VideoTimeZone} from '../../../../../src/backend/model/fileaccess/VideoTimeZone';
import {TestHelper} from '../../../../TestHelper';

declare const before: any;

describe('VideoTimeZone', () => {
  before(TestHelper.resetConfig);

  const utc = Date.parse('2025-08-15T06:00:00Z');
  const berlin = '+52.5200+013.4050/';

  describe('getDate', () => {
    it('should return the date unchanged without tags', () => {
      expect(VideoTimeZone.getDate(undefined, utc, true)).to.deep.equal({creationDate: utc});
      expect(VideoTimeZone.getDate({}, utc, true)).to.deep.equal({creationDate: utc});
    });

    it('should use com.apple.quicktime.creationdate first', () => {
      expect(VideoTimeZone.getDate({
        'com.apple.quicktime.creationdate': '2025-08-15T15:00:00+0900',
        'com.samsung.android.utc_offset': '+0100',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+09:00'});
    });

    it('should use com.apple.quicktime.creationdate also for the file system date', () => {
      expect(VideoTimeZone.getDate({'com.apple.quicktime.creationdate': '2025-08-15T15:00:00+0900'}, 1, false))
        .to.deep.equal({creationDate: utc, creationDateOffset: '+09:00'});
    });

    it('should skip com.apple.quicktime.creationdate without offset', () => {
      expect(VideoTimeZone.getDate({
        'com.apple.quicktime.creationdate': '2025-08-15T08:00:00',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+02:00'});
    });

    it('should skip an invalid com.apple.quicktime.creationdate', () => {
      expect(VideoTimeZone.getDate({
        'com.apple.quicktime.creationdate': '2025-13-45T99:16:03+0100',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+02:00'});
    });

    it('should use com.samsung.android.utc_offset second', () => {
      expect(VideoTimeZone.getDate({
        'com.samsung.android.utc_offset': '+0900',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+09:00'});
    });

    it('should skip an invalid com.samsung.android.utc_offset', () => {
      expect(VideoTimeZone.getDate({
        'com.samsung.android.utc_offset': '+2500',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+02:00'});
    });

    it('should use the GPS position third', () => {
      expect(VideoTimeZone.getDate({location: berlin}, utc, true))
        .to.deep.equal({creationDate: utc, creationDateOffset: '+02:00'});
    });

    it('should prefer com.apple.quicktime.location.ISO6709 over location', () => {
      expect(VideoTimeZone.getDate({
        'com.apple.quicktime.location.ISO6709': '+35.6895+139.6917+012.345/',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+09:00'});
    });

    it('should use location if com.apple.quicktime.location.ISO6709 is malformed', () => {
      expect(VideoTimeZone.getDate({
        'com.apple.quicktime.location.ISO6709': 'nowhere',
        location: berlin
      }, utc, true)).to.deep.equal({creationDate: utc, creationDateOffset: '+02:00'});
    });

    it('should not add an offset from 0,0 or malformed positions', () => {
      for (const location of ['+00.0000+000.0000/', '+0.0+0.0/', 'somewhere', '', '+91.0000+009.0000/']) {
        expect(VideoTimeZone.getDate({location}, utc, true), location).to.deep.equal({creationDate: utc});
      }
    });

    it('should only add an offset to a UTC date', () => {
      expect(VideoTimeZone.getDate({'com.samsung.android.utc_offset': '+0100', location: berlin}, utc, false))
        .to.deep.equal({creationDate: utc});
    });

    it('should find half hour offsets and the offset at the time of capture', () => {
      expect(VideoTimeZone.getDate({location: '+28.6139+077.2090/'}, utc, true).creationDateOffset).to.equal('+05:30');
      expect(VideoTimeZone.getDate({location: '-33.8688+151.2093/'}, Date.parse('2025-01-15T00:00:00Z'), true).creationDateOffset).to.equal('+11:00');
      expect(VideoTimeZone.getDate({location: '-33.8688+151.2093/'}, Date.parse('2025-07-15T00:00:00Z'), true).creationDateOffset).to.equal('+10:00');
      expect(VideoTimeZone.getDate({location: '+40.7128-074.0060/'}, Date.parse('2025-07-15T00:00:00Z'), true).creationDateOffset).to.equal('-04:00');
      expect(VideoTimeZone.getDate({location: '+51.5074-000.1278/'}, Date.parse('2025-01-15T00:00:00Z'), true).creationDateOffset).to.equal('+00:00');
    });
  });

  describe('parseUtcOffset', () => {
    const cases: [unknown, string | undefined][] = [
      ['+0100', '+01:00'], ['+01:00', '+01:00'], ['-0600', '-06:00'], ['+0530', '+05:30'],
      ['-0930', '-09:30'], ['+1400', '+14:00'], ['-1200', '-12:00'], ['+0000', '+00:00'],
      ['-0000', '+00:00'], [' +0200 ', '+02:00'],
      ['+1500', undefined], ['-1300', undefined], ['+0160', undefined], ['0100', undefined],
      ['+1', undefined], ['Z', undefined], ['', undefined],
      [undefined, undefined], [null, undefined], [100, undefined],
    ];
    for (const [input, expected] of cases) {
      it(String(JSON.stringify(input)), () => {
        expect(VideoTimeZone.parseUtcOffset(input)).to.equal(expected);
      });
    }
  });

  describe('parseQuickTimeCreationDate', () => {
    const cases: [unknown, [string | undefined, string | undefined]][] = [
      ['2025-07-11T09:44:38-0600', ['2025-07-11T09:44:38', '-06:00']],
      ['2025-07-11T09:44:38+0200', ['2025-07-11T09:44:38', '+02:00']],
      ['2025-07-11T09:44:38+02:00', ['2025-07-11T09:44:38', '+02:00']],
      ['2025-07-11T09:44:38+0530', ['2025-07-11T09:44:38', '+05:30']],
      ['2025-07-11T09:44:38.123+0100', ['2025-07-11T09:44:38.123', '+01:00']],
      [' 2025-07-11T09:44:38+0100 ', ['2025-07-11T09:44:38', '+01:00']],
      ['2025-07-11T09:44:38', [undefined, undefined]],
      ['2025-07-11T09:44:38Z', [undefined, undefined]],
      ['2025-07-11T09:44:38+1500', [undefined, undefined]],
      ['2025-07-11T09:44:38+0260', [undefined, undefined]],
      ['2025-07-11T09:44:38+2', [undefined, undefined]],
      ['garbage', [undefined, undefined]],
      ['', [undefined, undefined]],
      [undefined, [undefined, undefined]],
      [null, [undefined, undefined]],
      [12345, [undefined, undefined]],
    ];
    for (const [input, expected] of cases) {
      it(String(JSON.stringify(input)), () => {
        expect(VideoTimeZone.parseQuickTimeCreationDate(input)).to.deep.equal(expected);
      });
    }
  });

  describe('parseISO6709', () => {
    const cases: [unknown, { latitude: number, longitude: number } | undefined][] = [
      ['+52.5163+013.3777/', {latitude: 52.5163, longitude: 13.3777}],
      ['+52.5163+013.3777', {latitude: 52.5163, longitude: 13.3777}],
      ['+35.6895+139.6917+012.345/', {latitude: 35.6895, longitude: 139.6917}],
      ['-33.8688+151.2093-005.000/', {latitude: -33.8688, longitude: 151.2093}],
      ['+40.7128-074.0060/', {latitude: 40.7128, longitude: -74.006}],
      ['+48+009/', {latitude: 48, longitude: 9}],
      ['+52.5163+013.3777CRSWGS_84/', {latitude: 52.5163, longitude: 13.3777}],
      ['+00.0000+000.0000/', undefined],
      ['+91.0000+009.0000/', undefined],
      ['+48.0000+181.0000/', undefined],
      ['+5231.20+01324.30/', undefined], // degrees and minutes are not supported
      ['52.5163 13.3777', undefined],
      ['', undefined],
      [undefined, undefined],
      [null, undefined],
      [48.9, undefined],
    ];
    for (const [input, expected] of cases) {
      it(String(JSON.stringify(input)), () => {
        expect(VideoTimeZone.parseISO6709(input)).to.deep.equal(expected);
      });
    }
  });

  describe('getOffsetOfTimeZone', () => {
    it('should take daylight saving time into account', () => {
      expect(VideoTimeZone.getOffsetOfTimeZone('Europe/Berlin', Date.parse('2025-03-30T00:59:59Z'))).to.equal('+01:00');
      expect(VideoTimeZone.getOffsetOfTimeZone('Europe/Berlin', Date.parse('2025-03-30T01:00:00Z'))).to.equal('+02:00');
      expect(VideoTimeZone.getOffsetOfTimeZone('Europe/Berlin', Date.parse('2025-10-26T00:59:59Z'))).to.equal('+02:00');
      expect(VideoTimeZone.getOffsetOfTimeZone('Europe/Berlin', Date.parse('2025-10-26T01:00:00Z'))).to.equal('+01:00');
    });

    it('should return +00:00 for UTC zones', () => {
      expect(VideoTimeZone.getOffsetOfTimeZone('UTC', utc)).to.equal('+00:00');
      expect(VideoTimeZone.getOffsetOfTimeZone('Europe/London', Date.parse('2025-01-15T00:00:00Z'))).to.equal('+00:00');
    });

    it('should return ocean (Etc) zones', () => {
      expect(VideoTimeZone.getOffsetOfTimeZone('Etc/GMT+5', utc)).to.equal('-05:00');
    });

    it('should return undefined for invalid input', () => {
      expect(VideoTimeZone.getOffsetOfTimeZone('Not/AZone', utc)).to.be.undefined;
      expect(VideoTimeZone.getOffsetOfTimeZone('Europe/Berlin', NaN)).to.be.undefined;
    });
  });

  describe('getOffsetAtPosition', () => {
    it('should return undefined for positions that cannot be looked up', () => {
      expect(VideoTimeZone.getOffsetAtPosition(NaN, 9, utc)).to.be.undefined;
      expect(VideoTimeZone.getOffsetAtPosition(100, 9, utc)).to.be.undefined;
    });
  });
});
