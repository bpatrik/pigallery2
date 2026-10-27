import {expect} from 'chai';
import {SQLiteLike} from '../../../../../src/backend/model/database/SQLiteLike';
import {Config} from '../../../../../src/common/config/private/Config';
import {DatabaseType} from '../../../../../src/common/config/private/PrivateConfig';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const Database = require('better-sqlite3'); // no type declarations

declare const before: any;
declare const after: any;

describe('SQLiteLike', () => {
  const db = new Database(':memory:');
  SQLiteLike.register(db);
  db.exec('CREATE TABLE t (name TEXT)');
  const names = ['Noël à Biarritz', 'ÉTÉ 2015', 'été', 'Krikštynos', 'Šimtadienis', '100%_done', 'plain', null];
  const insert = db.prepare('INSERT INTO t VALUES (?)');
  names.forEach((n) => insert.run(n));
  let type: DatabaseType;
  before(() => {
    type = Config.Database.type;
    Config.Database.type = DatabaseType.sqlite;
  });
  after(() => {
    Config.Database.type = type;
  });
  const like = (pattern: string, escape = false, negate = false): string[] =>
    (db.prepare('SELECT name FROM t WHERE ' + SQLiteLike.where('name', 'p', escape, negate) + ' ORDER BY rowid')
      .all({p: SQLiteLike.param(pattern)}) as { name: string }[]).map((r) => r.name);

  it('should ignore case and accents', () => {
    expect(like('%noel%')).to.deep.equal(['Noël à Biarritz']);
    expect(like('%NOËL%')).to.deep.equal(['Noël à Biarritz']);
    expect(like('%ete%')).to.deep.equal(['ÉTÉ 2015', 'été']);
    expect(like('%été%')).to.deep.equal(['ÉTÉ 2015', 'été']);
    expect(like('%KRIKŠ%')).to.deep.equal(['Krikštynos']);
    expect(like('simtadienis')).to.deep.equal(['Šimtadienis']);
  });

  it('should keep the LIKE wildcards, escape and negation', () => {
    expect(like('pla_n')).to.deep.equal(['plain']);
    expect(like('PLA%')).to.deep.equal(['plain']);
    expect(like('plai')).to.deep.equal([]);
    expect(like('%\\%\\_%', true)).to.deep.equal(['100%_done']);
    expect(like('%\\%x%', true)).to.deep.equal([]);
    expect(like('%e%', false, true)).to.deep.equal(['Krikštynos', 'plain']);
  });

  it('should compare like SQL LIKE in JavaScript', () => {
    expect(SQLiteLike.like('%noel%', 'Noël')).to.equal(1);
    expect(SQLiteLike.like('n_el', 'Noël')).to.equal(1);
    expect(SQLiteLike.like('noe', 'Noël')).to.equal(0);
    expect(SQLiteLike.like('%', null)).to.equal(null);
  });
});
