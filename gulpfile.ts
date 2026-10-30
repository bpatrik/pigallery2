import * as gulp from 'gulp';
import * as fs from 'fs';
import {promises as fsp} from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as zip from 'gulp-zip';
import * as ts from 'gulp-typescript';
import * as sourcemaps from 'gulp-sourcemaps';
import * as xml2js from 'xml2js';
import * as child_process from 'child_process';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as jeditor from 'gulp-json-editor';
import {XLIFF} from 'xlf-google-translate';
import {PrivateConfigClass} from './src/common/config/private/PrivateConfigClass';
import {ConfigClassBuilder} from 'typeconfig/node';
import {PG2ConfMap, ServerPG2ConfMap} from './src/common/PG2ConfMap';

const execPr = util.promisify(child_process.exec);

const translationFolder = 'translate';
const tsBackendProject = ts.createProject('tsconfig.json');
declare const process: NodeJS.Process;

const getSwitch = (name: string, def: string = null): string => {
  name = '--' + name;
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i].startsWith(name + '=')) {
      return process.argv[i].replace(name + '=', '').trim();
    }
    if (process.argv[i].startsWith(name)) {
      if (i + 1 < process.argv.length) {
        return process.argv[i + 1].trim();
      }
      return 'true';
    }
  }
  return def;
};

gulp.task('build-backend', (): any =>
  gulp
    .src(['src/common/**/*.ts', 'src/backend/**/*.ts', 'benchmark/**/*.ts'], {
      base: '.'
    })
    .pipe(sourcemaps.init())
    .pipe(tsBackendProject())
    .pipe(sourcemaps.write('.', {includeContent: false}))
    .pipe(gulp.dest('./release'))
);

const createDynamicTranslationFile = async (
  language: string
): Promise<void> => {
  // load
  const folder = './src/frontend/' + translationFolder;
  const data: string = await fsp.readFile(
    path.join(folder, `messages.${language}.xlf`),
    'utf-8'
  );
  const translationXml: XLIFF.Root = await xml2js.parseStringPromise(data);

  // clean translations, keep only .ts translations
  const hasTsTranslation = (cg: XLIFF.ContextGroup): boolean =>
    cg.context.findIndex(
      (c: any): boolean =>
        c.$['context-type'] === 'sourcefile' && c._.endsWith('.ts')
    ) !== -1;
  const translations = translationXml.xliff.file[0].body[0]['trans-unit'];
  const filtered = translations.filter(
    (tr): boolean => tr['context-group'].findIndex(hasTsTranslation) !== -1
  );
  filtered.forEach((tr): boolean => delete tr['context-group']);
  translationXml.xliff.file[0].body[0]['trans-unit'] = filtered;

  // save
  const builder = new xml2js.Builder();
  const xml = builder.buildObject(translationXml);
  await fsp.writeFile(path.join(folder, `ts-only-msg.${language}.xlf`), xml);
};

const removeDynamicTranslationFile = async (
  language: string
): Promise<void> => {
  const translationFile = path.join(
    './src/frontend/',
    translationFolder,
    `ts-only-msg.${language}.xlf`
  );
  fsp.unlink(translationFile);
};

const setDynTransFileAtAppModule = async (language: string): Promise<void> => {
  const file = './src/frontend/app/app.module.ts';
  let data: string = await fsp.readFile(file, 'utf-8');
  const from = 'messages.${locale}.xlf';
  const to = `ts-only-msg.${language}.xlf`;
  data = data.replace(from, to);
  await fsp.writeFile(file, data);
};

const resetAppModule = async (language: string): Promise<void> => {
  const file = './src/frontend/app/app.module.ts';
  let data: string = await fsp.readFile(file, 'utf-8');
  const from = 'messages.${locale}.xlf';
  const to = `ts-only-msg.${language}.xlf`;
  data = data.replace(to, from);
  await fsp.writeFile(file, data);
};

const createFrontendTask = (
  type: string,
  script: string
): void => {
  gulp.task(type, async (cb): Promise<void> => {
    try {
      const {stdout, stderr} = await execPr(script);
      console.log(stdout);
      console.error(stderr);
    } catch (e) {
      console.error(e);
      cb(e);
    }
  });
};

const getLanguages = (): any[] | string[] => {
  if (!fs.existsSync('./src/frontend/' + translationFolder)) {
    return [];
  }
  const dirCont = fs.readdirSync('./src/frontend/' + translationFolder);
  const files: string[] = dirCont.filter((elm): any => {
    return elm.match(/.*\.[a-zA-Z]+(-[a-zA-Z]+)?\.(xlf)/gi);
  });

  // get languages to filter
  let languageFilter: string[] = null;
  if (getSwitch('languages')) {
    languageFilter = getSwitch('languages').split(',');
  }

  let languages = files.map((f: string): string => {
    return f.split('.')[1];
  });

  if (languageFilter !== null) {
    languages = languages.filter((l): boolean => {
      return languageFilter.indexOf(l) !== -1;
    });
  }
  return languages;
};

gulp.task(
  'build-frontend',
  ((): any => {
    const tasks = [];
    createFrontendTask(
      'build-frontend-release default',
      'ng build --configuration production,release --no-progress'
    );
    tasks.push('build-frontend-release default');
    return gulp.series(...tasks);
  })()
);

gulp.task('copy-static-images', (): any =>
  gulp
    .src(
      [
        'src/backend/model/diagnostics/image_formats/**',
        'src/backend/model/diagnostics/blank.jpg',
      ],
      {base: '.', encoding: false} // treat files as binary
    )
    .pipe(gulp.dest('./release'))
);

gulp.task('copy-static-text', (): any =>
  gulp
    .src(
      [
        'README.md',
        //  'package-lock.json', should not add, it keeps optional packages optional even with --force-opt-packages.
        'LICENSE',
      ],
      {base: '.'}
    )
    .pipe(gulp.dest('./release'))
);

gulp.task('copy-static',
  gulp.series('copy-static-images', 'copy-static-text')
);
gulp.task('copy-package', (): any =>
  gulp
    .src(['package.json'], {base: '.'})
    .pipe(
      jeditor(
        (json: {
          devDependencies: { [key: string]: string };
          scripts: { [key: string]: string };
          dependencies: { [key: string]: string };
          optionalDependencies: { [key: string]: string };
          buildTime: string;
          buildCommitHash: string;
        }): {
          devDependencies: { [p: string]: string };
          scripts: { [p: string]: string };
          dependencies: { [p: string]: string };
          optionalDependencies: { [p: string]: string };
          buildTime: string;
          buildCommitHash: string;
        } => {
          delete json.devDependencies;
          json.scripts = {start: 'node ./src/backend/index.js'};

          if (getSwitch('skip-opt-packages')) {
            const skipPackages = getSwitch('skip-opt-packages')
              .replace(new RegExp(' ', 'g'), ',')
              .split(',');
            for (const pkg of skipPackages) {
              for (const key of Object.keys(json.optionalDependencies)) {
                if (key.indexOf(pkg) !== -1) {
                  delete json.optionalDependencies[key];
                }
              }
            }
          }

          if (getSwitch('force-opt-packages')) {
            for (const key of Object.keys(json.optionalDependencies)) {
              json.dependencies[key] = json.optionalDependencies[key];
            }
            delete json.optionalDependencies;
          }
          json.buildTime = new Date().toISOString();

          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            json.buildCommitHash = require('child_process')
              .execSync('git rev-parse HEAD')
              .toString()
              .trim();
            // eslint-disable-next-line no-empty
          } catch (e) {
          }

          return json;
        }
      )
    )
    .pipe(gulp.dest('./release'))
);

gulp.task('zip-release', (): any =>
  gulp
    .src(['release/**/*'], {base: './release'})
    .pipe(zip('pigallery2.zip'))
    .pipe(gulp.dest('.'))
);


const simpleBuild = (isProd: boolean): any => {
  const tasks = [];
  let cmd = 'ng build ';
  if (isProd) {
    cmd += ' --configuration production --no-extract-licenses ';
  }
  createFrontendTask('build-frontend default', cmd);
  tasks.push('build-frontend default');
  return gulp.series(...tasks);
};

gulp.task('extract-locale', async (cb): Promise<any> => {
  console.log('creating source translation file:  locale.source.xlf');
  try {
    {
      const {stdout, stderr} = await execPr(
        'ng extract-i18n --out-file=locale.source.xlf  --format=xlf',
        {maxBuffer: 1024 * 1024}
      );
      console.log(stdout);
      console.error(stderr);
    }
    cb();
  } catch (e) {
    console.error(e);
    return cb(e);
  }
});

const translate = async (
  list: any[],
  cb: (err?: any) => void
): Promise<void> => {
  try {
    const localsStr = '"[\\"' + list.join('\\",\\"') + '\\"]"';
    const {stdout, stderr} = await execPr(
      'xlf-google-translate ' +
      '--source-lang="en" ' +
      '--source-file="./locale.source.xlf" ' +
      '--destination-filename="messages" ' +
      '--destination-folder="./src/frontend/"' +
      translationFolder +
      ' --destination-languages=' +
      localsStr
    );
    console.log(stdout);
    console.error(stderr);
    cb();
  } catch (e) {
    console.error(e);
    return cb(e);
  }
};
const merge = async (list: any[], cb: (err?: any) => void): Promise<void> => {
  try {
    const localsStr = '"[\\"' + list.join('\\",\\"') + '\\"]"';
    const command =
      'xlf-google-translate ' +
      '--method="extend-only" ' +
      '--source-lang="en" ' +
      '--source-file="./locale.source.xlf" ' +
      '--destination-filename="messages" ' +
      '--destination-folder="./src/frontend/' +
      translationFolder +
      '" ' +
      '--destination-languages=' +
      localsStr;
    console.log(command);
    const {stdout, stderr} = await execPr(command);
    console.log(stdout);
    console.error(stderr);
    cb();
  } catch (e) {
    console.error(e);
    return cb(e);
  }
};

gulp.task('update-translation-only', (cb): void => {
  translate(getLanguages(), cb).catch(console.error);
});
gulp.task('merge-translation-only', (cb): void => {
  merge(getLanguages(), cb).catch(console.error);
});

gulp.task(
  'update-translation',
  gulp.series('extract-locale', 'update-translation-only')
);

gulp.task(
  'merge-new-translation',
  gulp.series('extract-locale', 'merge-translation-only')
);

gulp.task('add-translation-only', (cb): any => {
  const languages = getLanguages();
  let lng = null;
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === 'add-translation') {
      lng = process.argv[i + 1].replace('--', '');
    }
  }
  if (lng == null) {
    console.error(
      'Error: set language with \'--\' e.g: npm run add-translation -- --en'
    );
    return cb();
  }
  if (languages.indexOf(lng) !== -1) {
    console.error(
      'Error: language already exists, can\'t add. These language(s) already exist(s): ' +
      languages
    );
    return cb();
  }
  translate([lng], cb);
});

gulp.task('generate-man', async (cb): Promise<void> => {
  const defCFG = ConfigClassBuilder.attachInterface(new PrivateConfigClass());
  defCFG.Server.sessionSecret = [];
  let txt = '# Pigallery 2 man page\n';
  txt +=
    'pigallery2 uses [typeconfig](https://github.com/bpatrik/typeconfig) for configuration\n\n';
  txt += '`npm start -- --help` prints the following:\n\n';
  txt +=
    '```\n' +
    ConfigClassBuilder.attachPrivateInterface(defCFG).__printMan() +
    '```';
  txt += '\n\n ### `config.json` sample:\n\n';
  txt += '```json\n' + JSON.stringify(defCFG, null, 4) + '\n```\n';

  // Generate directory configurations man page section
  const getDesc = (filename: string, side: 'Client' | 'Server'): string => {
    if (filename === '.uploader.pg2conf') {
      return 'Whitelists the directory for file uploads. When enforced, users can only upload files to directories containing this file.';
    }
    if (filename === '.saved_searches.pg2conf') {
      return 'Stores saved searches (logical albums) at the directory level. These searches survive database resets and are loaded during directory indexing.';
    }
    if (filename === '.order_random.pg2conf') {
      return 'Forces the directory contents to be sorted in a random order.';
    }
    if (filename.startsWith('.order_descending_') && filename.endsWith('.pg2conf')) {
      const method = filename.substring('.order_descending_'.length, filename.length - '.pg2conf'.length);
      return `Forces the directory contents to be sorted by ${method} in descending order.`;
    }
    if (filename.startsWith('.order_ascending_') && filename.endsWith('.pg2conf')) {
      const method = filename.substring('.order_ascending_'.length, filename.length - '.pg2conf'.length);
      return `Forces the directory contents to be sorted by ${method} in ascending order.`;
    }
    return `Unknown ${side.toLowerCase()}-side configuration behavior.`;
  };

  txt += '\n## Supported Directory Configuration (`.pg2conf`) Files\n\n';
  txt += 'The following files can be placed in gallery directories to customize behavior (such as sorting, file upload permissions, and saved searches):\n\n';
  txt += '| File Name | Processing Side | Description |\n';
  txt += '| --- | --- | --- |\n';

  // Gather client side files dynamically
  const clientFiles: string[] = [];
  for (const category of Object.keys(PG2ConfMap)) {
    const subMap = (PG2ConfMap as any)[category];
    for (const filename of Object.keys(subMap)) {
      clientFiles.push(filename);
    }
  }
  clientFiles.sort();

  for (const filename of clientFiles) {
    txt += `| \`${filename}\` | Client | ${getDesc(filename, 'Client')} |\n`;
  }

  // Gather server side files dynamically
  const serverFiles = Object.keys(ServerPG2ConfMap);
  serverFiles.sort();

  for (const filename of serverFiles) {
    txt += `| \`${filename}\` | Server | ${getDesc(filename, 'Server')} |\n`;
  }

  await fsp.writeFile(path.join(__dirname, 'docs', 'user-guide', 'configuration.md'), txt);
  cb();
});

// this is a workaround for bundle hash is not considering localization
// so all the js files would have the same name in every locale. All locales are served from the same urls,
// so the browser cache would mix the languages.
// Prefixing every js file (lazy chunks and polyfills too) with the locale to keep them apart.
// see: https://github.com/angular/angular-cli/issues/17416
gulp.task('localize-bundles', async (cb): Promise<void> => {
  const foldersToCheck = ['./dist', './release/dist'];
  for (const folder of foldersToCheck) {
    if (!fs.existsSync(folder)) {
      continue;
    }
    for (const locale of fs.readdirSync(folder)) {
      const dir = path.join(folder, locale);
      // the builder also writes files (e.g. prerendered-routes.json) next to the locale folders
      if (!fs.statSync(dir).isDirectory()) {
        continue;
      }
      const bundles = fs.readdirSync(dir)
        .filter(fl => fl.endsWith('.js') && !fl.startsWith(locale + '.'));
      if (bundles.length === 0) {
        continue;
      }
      // the bundles are referenced after a quote (index.html) or after './' (imports between the bundles)
      const rgx = new RegExp('(["\'/])(' + bundles.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
      const filesToUpdate = fs.readdirSync(dir)
        .filter(fl => fl.endsWith('.js') || fl === 'index.html');
      for (const file of filesToUpdate) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const updated = content.replace(rgx, '$1' + locale + '.$2');
        if (updated !== content) {
          fs.writeFileSync(filePath, updated, 'utf8');
        }
      }
      for (const bundle of bundles) {
        fs.renameSync(path.join(dir, bundle), path.join(dir, locale + '.' + bundle));
      }
    }
  }
  cb();
});

gulp.task(
  'add-translation',
  gulp.series('extract-locale', 'add-translation-only')
);

gulp.task('build-dev', simpleBuild(false));
gulp.task('build-prod', gulp.series(simpleBuild(true), 'localize-bundles'));

gulp.task(
  'create-release',
  gulp.series(
    'build-frontend',
    'localize-bundles',
    'build-backend',
    'copy-static',
    'copy-package',
    'zip-release'
  )
);
