/*
  Scoped cache schema performance benchmark
  - Variant A: denormalized scopeKey TEXT in cache tables
  - Variant B: normalized ScopeKey table with FK (ON DELETE CASCADE)

  Usage:
    npx ts-node benchmark\\scoped-cache-bench.ts

  Notes:
    - Uses a temporary SQLite DB at db\\scoped_bench.sqlite
    - Does NOT touch the application DB
*/

import 'reflect-metadata';
import {DataSource, Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, Unique, Repository} from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// -------------------- Entities (Variant A - denormalized) --------------------

@Entity({ name: 'scoped_dir_a' })
@Unique(['scopeKey', 'directoryId'])
class ScopedDirA {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @Index()
  @Column('text')
  scopeKey!: string;

  @Index()
  @Column('int', { unsigned: true })
  directoryId!: number;

  @Column('int', { unsigned: true })
  mediaCount!: number;

  @Column('bigint', { nullable: true })
  oldestMedia!: number | null;

  @Column('bigint', { nullable: true })
  youngestMedia!: number | null;

  @Column('int', { unsigned: true, nullable: true })
  coverMediaId!: number | null;

  @Column('bigint', { unsigned: true })
  updatedAt!: number;
}

@Entity({ name: 'scoped_person_a' })
@Unique(['scopeKey', 'personId'])
class ScopedPersonA {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @Index()
  @Column('text')
  scopeKey!: string;

  @Index()
  @Column('int', { unsigned: true })
  personId!: number;

  @Column('int', { unsigned: true })
  count!: number;

  @Column('int', { unsigned: true, nullable: true })
  sampleRegionId!: number | null;

  @Column('bigint', { unsigned: true })
  updatedAt!: number;
}

// -------------------- Entities (Variant B - normalized with FK) --------------------

@Entity({ name: 'scope_key_b' })
@Unique(['key'])
class ScopeKeyB {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @Index()
  @Column('text')
  key!: string;

  @Column('bigint', { unsigned: true })
  createdAt!: number;
}

@Entity({ name: 'scoped_dir_b' })
@Unique(['scope', 'directoryId'])
class ScopedDirB {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @ManyToOne(() => ScopeKeyB, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'scopeId' })
  scope!: ScopeKeyB;

  @Index()
  @Column('int', { unsigned: true })
  directoryId!: number;

  @Column('int', { unsigned: true })
  mediaCount!: number;

  @Column('bigint', { nullable: true })
  oldestMedia!: number | null;

  @Column('bigint', { nullable: true })
  youngestMedia!: number | null;

  @Column('int', { unsigned: true, nullable: true })
  coverMediaId!: number | null;

  @Column('bigint', { unsigned: true })
  updatedAt!: number;
}

@Entity({ name: 'scoped_person_b' })
@Unique(['scope', 'personId'])
class ScopedPersonB {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @ManyToOne(() => ScopeKeyB, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'scopeId' })
  scope!: ScopeKeyB;

  @Index()
  @Column('int', { unsigned: true })
  personId!: number;

  @Column('int', { unsigned: true })
  count!: number;

  @Column('int', { unsigned: true, nullable: true })
  sampleRegionId!: number | null;

  @Column('bigint', { unsigned: true })
  updatedAt!: number;
}

// -------------------- Bench helpers --------------------

function hrtimeMs(start?: bigint): number | bigint {
  const now = process.hrtime.bigint();
  if (!start) return now;
  return Number(now - start) / 1_000_000; // ms
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number; result: T }> {
  const s = hrtimeMs() as bigint;
  const result = await fn();
  const ms = hrtimeMs(s) as number;
  console.log(`${label}: ${ms.toFixed(2)} ms`);
  return { label, ms, result };
}

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

async function upsertBatch(repo: Repository<any>, items: any[], conflictPaths: string[], chunk = 1000) {
  for (let i = 0; i < items.length; i += chunk) {
    const slice = items.slice(i, i + chunk);
    await repo.upsert(slice as any, conflictPaths as any);
  }
}

// -------------------- Main --------------------

(async () => {
  const dbFolder = path.join(process.cwd(), 'db');
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder);
  }
  const dbPath = path.join(dbFolder, 'scoped_bench.sqlite');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const ds = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    entities: [ScopeKeyB, ScopedDirA, ScopedPersonA, ScopedDirB, ScopedPersonB],
    synchronize: true,
    dropSchema: true,
  });

  await ds.initialize();

  // Add FKs for cascade manually (TypeORM for better-sqlite3 sets them, but ensure PRAGMA is on)
  await ds.query('PRAGMA foreign_keys = ON');

  const scopeRepoB = ds.getRepository(ScopeKeyB);
  const dirARepo = ds.getRepository(ScopedDirA);
  const personARepo = ds.getRepository(ScopedPersonA);
  const dirBRepo = ds.getRepository(ScopedDirB);
  const personBRepo = ds.getRepository(ScopedPersonB);

  // Parameters (can be tweaked via env vars)
  const N = parseInt(process.env.BENCH_SCOPES || '100', 10); // scopes
  const D = parseInt(process.env.BENCH_DIRS || '500', 10);  // directories
  const P = parseInt(process.env.BENCH_PERSONS || '300', 10); // persons
  const lookups = parseInt(process.env.BENCH_LOOKUPS || '10000', 10); // lookup ops

  console.log('Benchmark params:', { N, D, P, lookups });

  const scopeKeys: string[] = Array.from({ length: N }, (_, i) => `scope_${i}_${Math.random().toString(36).slice(2, 10)}`);

  // Prepare ScopeKeyB rows
  await time('B.insert ScopeKey rows', async () => {
    const rows = scopeKeys.map((k) => {
      const r = new ScopeKeyB();
      r.key = k;
      r.createdAt = Date.now();
      return r;
    });
    await scopeRepoB.insert(rows);
  });

  const scopeIdByKey = new Map<string, number>();
  {
    const rows = await scopeRepoB.find();
    rows.forEach((r) => scopeIdByKey.set(r.key, r.id));
  }

  // Create data for Variant A
  await time('A.upsert ScopedDirA', async () => {
    const batch: ScopedDirA[] = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      for (let d = 1; d <= D; d++) {
        const row = new ScopedDirA();
        row.scopeKey = scopeKeys[i];
        row.directoryId = d;
        row.mediaCount = (d * 7 + i) % 50;
        row.oldestMedia = now - ((d + i) % 1000) * 86400000;
        row.youngestMedia = now - ((d + i) % 100) * 86400000;
        row.coverMediaId = ((d + i) % 3 === 0) ? ((d + i) % 1000) : null;
        row.updatedAt = now;
        batch.push(row);
      }
    }
    await upsertBatch(dirARepo, batch, ['scopeKey', 'directoryId']);
  });

  await time('A.upsert ScopedPersonA', async () => {
    const batch: ScopedPersonA[] = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      for (let p = 1; p <= P; p++) {
        const row = new ScopedPersonA();
        row.scopeKey = scopeKeys[i];
        row.personId = p;
        row.count = (p * 11 + i) % 30;
        row.sampleRegionId = ((p + i) % 4 === 0) ? ((p + i) % 5000) : null;
        row.updatedAt = now;
        batch.push(row);
      }
    }
    await upsertBatch(personARepo, batch, ['scopeKey', 'personId']);
  });

  // Create data for Variant B
  await time('B.upsert ScopedDirB', async () => {
    const batch: ScopedDirB[] = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      const scopeId = scopeIdByKey.get(scopeKeys[i])!;
      for (let d = 1; d <= D; d++) {
        const row = new ScopedDirB();
        row.scope = { id: scopeId } as any;
        row.directoryId = d;
        row.mediaCount = (d * 7 + i) % 50;
        row.oldestMedia = now - ((d + i) % 1000) * 86400000;
        row.youngestMedia = now - ((d + i) % 100) * 86400000;
        row.coverMediaId = ((d + i) % 3 === 0) ? ((d + i) % 1000) : null;
        row.updatedAt = now;
        batch.push(row);
      }
    }
    await upsertBatch(dirBRepo, batch, ['scope', 'directoryId']);
  });

  await time('B.upsert ScopedPersonB', async () => {
    const batch: ScopedPersonB[] = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      const scopeId = scopeIdByKey.get(scopeKeys[i])!;
      for (let p = 1; p <= P; p++) {
        const row = new ScopedPersonB();
        row.scope = { id: scopeId } as any;
        row.personId = p;
        row.count = (p * 11 + i) % 30;
        row.sampleRegionId = ((p + i) % 4 === 0) ? ((p + i) % 5000) : null;
        row.updatedAt = now;
        batch.push(row);
      }
    }
    await upsertBatch(personBRepo, batch, ['scope', 'personId']);
  });

  // Lookup tests
  await time('A.lookup ScopedDirA', async () => {
    for (let i = 0; i < lookups; i++) {
      const k = scopeKeys[randInt(N)];
      const d = 1 + randInt(D);
      await dirARepo.findOne({ where: { scopeKey: k, directoryId: d } });
    }
  });

  await time('B.lookup ScopedDirB', async () => {
    for (let i = 0; i < lookups; i++) {
      const k = scopeKeys[randInt(N)];
      const scopeId = scopeIdByKey.get(k)!;
      const d = 1 + randInt(D);
      await dirBRepo.createQueryBuilder('b').where('b.scopeId = :sid AND b.directoryId = :d', { sid: scopeId, d }).getOne();
    }
  });

  // Cascade delete tests (delete half of scopes)
  const half = Math.floor(N / 2);
  const deleteKeys = scopeKeys.slice(0, half);

  const sizeBefore = fs.statSync(dbPath).size;

  await time('A.delete scope rows by scopeKey (2 tables)', async () => {
    // delete in both A tables
    await dirARepo.createQueryBuilder().delete().where('scopeKey IN (:...keys)', { keys: deleteKeys }).execute();
    await personARepo.createQueryBuilder().delete().where('scopeKey IN (:...keys)', { keys: deleteKeys }).execute();
  });

  await time('B.delete ScopeKey rows (cascade)', async () => {
    await scopeRepoB.createQueryBuilder().delete().where('key IN (:...keys)', { keys: deleteKeys }).execute();
  });

  const sizeAfter = fs.statSync(dbPath).size;

  console.log('\nSQLite DB file size (bytes): before:', sizeBefore, 'after:', sizeAfter, 'delta:', sizeAfter - sizeBefore);

  await ds.destroy();

  console.log('\nDone. You can tweak parameters via env vars: BENCH_SCOPES, BENCH_DIRS, BENCH_PERSONS, BENCH_LOOKUPS');
})();
