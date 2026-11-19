import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {ConfigClassBuilder} from 'typeconfig/node';
import {ThemeConfig, ThemesConfig} from '../../../../src/common/config/public/ClientConfig';
import {PrivateConfigClass} from '../../../../src/common/config/private/PrivateConfigClass';
import {TestHelper} from '../../../TestHelper';

describe('ThemesConfig built-in themes', () => {
  before(TestHelper.resetConfig);

  const builtIns = (): { name: string, theme: string }[] =>
    ThemesConfig.BUILT_IN_THEMES.map(th => ({name: th.name, theme: th.theme}));
  const names = (themes: ThemeConfig[]): string[] => themes.map(th => th.name!);

  it('should have classic and modern, and modern as the default', () => {
    const themes = new ThemesConfig();
    expect(names(themes.availableThemes)).to.deep.equal(['classic', 'modern']);
    expect(themes.selectedTheme).to.equal('modern');
    expect(ThemesConfig.isBuiltInTheme('modern')).to.be.true;
    expect(ThemesConfig.isBuiltInTheme('my theme')).to.be.false;
    expect(ThemesConfig.isBuiltInTheme('default')).to.be.false;
  });

  it('should restore changed and deleted built-in themes and keep the custom ones', () => {
    const themes = new ThemesConfig();
    themes.availableThemes = [
      new ThemeConfig('Árvíztűrő', 'body {color: red;}'),
      new ThemeConfig('classic', 'changed'),
    ];

    ThemesConfig.applyBuiltInThemes(themes);

    expect(themes.availableThemes.map(th => ({name: th.name, theme: th.theme}))).to.deep.equal([
      ...builtIns(),
      {name: 'Árvíztűrő', theme: 'body {color: red;}'}
    ]);
  });

  it('should restore the built-in themes when loading a config file', () => {
    const configPath = path.join(TestHelper.TMP_DIR, 'themes-config.json');
    fs.mkdirSync(TestHelper.TMP_DIR, {recursive: true});
    fs.writeFileSync(configPath, JSON.stringify({
      Gallery: {
        Themes: {
          selectedTheme: 'classic',
          availableThemes: [{name: 'classic', theme: 'changed'}, {name: 'mine', theme: 'a {}'}]
        }
      }
    }));
    try {
      const config = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
      config.loadSync({pathOverride: configPath, preventSaving: true});

      expect(config.Gallery.Themes.selectedTheme).to.equal('classic');
      expect(config.Gallery.Themes.availableThemes.map(th => ({name: th.name, theme: th.theme}))).to.deep.equal([
        ...builtIns(),
        {name: 'mine', theme: 'a {}'}
      ]);
    } finally {
      fs.rmSync(configPath, {force: true});
    }
  });
});
