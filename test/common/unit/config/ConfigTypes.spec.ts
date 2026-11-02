import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {ServerConfig} from '../../../../src/common/config/private/PrivateConfig';

// The frontend is built without decorator metadata (emitDecoratorMetadata: false),
// so typeconfig can't infer the type of a @ConfigProperty there.
describe('Config property types', () => {
  const configDir = path.join(__dirname, '../../../../src/common/config');
  const snapshotPath = path.join(__dirname, 'ConfigTypes.snapshot.json');

  const listTsFiles = (dir: string): string[] =>
    fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        return listTsFiles(p);
      }
      return p.endsWith('.ts') && !p.endsWith('.d.ts') ? [p] : [];
    });

  it('should set the type of every @ConfigProperty explicitly', () => {
    const missing: string[] = [];
    for (const file of listTsFiles(configDir)) {
      const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
      const visit = (node: ts.Node): void => {
        if (ts.isPropertyDeclaration(node)) {
          for (const d of ts.getDecorators(node) || []) {
            if (!ts.isCallExpression(d.expression) || d.expression.expression.getText(sf) !== 'ConfigProperty') {
              continue;
            }
            const options = d.expression.arguments[0];
            const hasType = options && ts.isObjectLiteralExpression(options) &&
              options.properties.some((p) => p.name?.getText(sf) === 'type');
            if (!hasType) {
              const {line} = sf.getLineAndCharacterOfPosition(node.getStart(sf));
              missing.push(path.relative(configDir, file) + ':' + (line + 1) + ' ' + node.name.getText(sf));
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(missing, 'add a "type" to these @ConfigProperty-s').to.deep.equal([]);
  });

  it('should resolve the same types as the snapshot', () => {
    const describeType = (t: unknown): string => {
      if (typeof t === 'string') {
        return t;
      }
      if (typeof t === 'function') {
        return 'config';
      }
      return 'enum:' + Object.keys(t).filter((k) => isNaN(Number(k))).join(',');
    };
    const types: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (cls: any, prefix: string): void => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state: Record<string, any> = cls.prototype.__state || {};
      for (const key of Object.keys(state).sort()) {
        const p = state[key];
        const name = prefix + key;
        types[name] = describeType(p.type) + (p.arrayType ? '<' + describeType(p.arrayType) + '>' : '');
        if (p.isConfigType) {
          walk(p.type, name + '.');
        }
        if (p.isConfigArrayType) {
          walk(p.arrayType, name + '[].');
        }
      }
    };
    walk(ServerConfig, '');

    if (process.env['UPDATE_CONFIG_SNAPSHOT'] === 'true') {
      fs.writeFileSync(snapshotPath, JSON.stringify(types, null, 2) + '\n');
    }
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    expect(types, 'config types changed. If intended, rerun with UPDATE_CONFIG_SNAPSHOT=true').to.deep.equal(snapshot);
  });
});
