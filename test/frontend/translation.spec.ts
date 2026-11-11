import {ProjectPath} from '../../src/backend/ProjectPath';
import {promises as fsp} from 'node:fs';
import * as path from 'node:path';
import {TestHelper} from '../TestHelper';
import {expectToFail} from '../backend/KnownFailures';

const chai = require('chai');
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;


describe('UI', () => {


  it('translation should be listed in the angular.json', async () => {
    const base = path.join('src', 'frontend', 'translate');
    const translations = await fsp.readdir(path.join(ProjectPath.Root, base));
    const angularConfig = require(path.join(ProjectPath.Root, 'angular.json'));
    const knownTranslations = angularConfig.projects.pigallery2.i18n.locales;


    for (const t of translations) {
      let lang = t.substring(t.indexOf('.') + 1, t.length-4);
      if (lang === 'en') {
        continue; // no need to add 'en' as it is the default language.
      }
      if (lang === 'cn') {
        lang = 'zh'; // zh county code is Chinese
      }
      const translationPath = path.join(base, t).replace(new RegExp('\\\\', 'g'), '/');
      expect(knownTranslations[lang]).to.deep.equal({
        baseHref: '',
        translation: translationPath
      }, translationPath + ' should be added to angular.json');
    }


  });


});

describe('Translations (#1344)', () => {
  before(TestHelper.resetConfig);

  // the source texts of the translation units that come from that template
  const sourcesOf = async (template: string): Promise<string[]> => {
    const xlf = await fsp.readFile(path.join(ProjectPath.Root, 'src', 'frontend', 'translate', 'messages.en.xlf'), 'utf8');
    return [...xlf.matchAll(/<trans-unit[^>]*>\s*<source>([\s\S]*?)<\/source>([\s\S]*?)<\/trans-unit>/g)]
      .filter(m => m[2].includes(template))
      .map(m => m[1]);
  };

  // the duplicates page summary ("Listing N duplicates (M photos).") is not wrapped in i18n
  it('should translate the duplicates summary', async () => {
    const sources = await sourcesOf('src/frontend/app/ui/duplicates/duplicates.component.html');
    expect(sources.join('\n')).to.contain('No duplicates found');
    // the summary is in messages.en.xlf once it is translatable and `npm run merge-new-translation` ran
    await expectToFail('#1344', () => expect(sources.some(s => s.includes('Listing') && s.includes('duplicates')),
      'the summary is in messages.en.xlf').to.equal(true), /the summary is in messages.en.xlf/);
  });
});
