"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
const ProjectPath_1 = require("../../src/backend/ProjectPath");
const fs_1 = require("fs");
const path = require("path");
const chai = require('chai');
const { expect } = chai;
describe('UI', () => {
    it('translation should be listed in the angular.json', async () => {
        const base = path.join('src', 'frontend', 'translate');
        const translations = await fs_1.promises.readdir(path.join(ProjectPath_1.ProjectPath.Root, base));
        const angularConfig = require(path.join(ProjectPath_1.ProjectPath.Root, 'angular.json'));
        const knownTranslations = angularConfig.projects.pigallery2.i18n.locales;
        for (const t of translations) {
            let lang = t.substring(t.indexOf('.') + 1, t.length - 4);
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
//# sourceMappingURL=translation.spec.js.map