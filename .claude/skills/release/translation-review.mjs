#!/usr/bin/env node
// Exports the translation units that need a human look to a small JSON file, and writes reviewed translations back.
// The .xlf files are huge (every unit carries its source locations); this keeps the review to the strings that matter.
//
//   node .claude/skills/release/translation-review.mjs export [--lang hu] [--since <git-ref>] [--with-admin] [--out <file>]
//   node .claude/skills/release/translation-review.mjs apply <file> [--lang hu]
//
// export lists the units that are new or whose English source changed since <git-ref> (default: the last tag),
// plus every unit whose translation still equals the English source. Units already reviewed (listed in
// translation-reviewed.<lang>.json next to this file) and units used only by the admin UI
// (settings, admin, duplicates, job texts, config) are skipped; --with-admin includes the admin ones.
// Output: [{id, reason, where, source, target}], text with XML entities decoded; placeholders stay as <x .../> tags.
// apply reads the same JSON (only `id` and `target` are used) and replaces those targets in the .xlf.
// It refuses a translation whose placeholders differ from the source's, and records the ids as reviewed
// (the id is a hash of the English text, so a changed English string comes back as a new id).

import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ADMIN_PATHS = [
  'src/frontend/app/ui/settings/',
  'src/frontend/app/ui/admin/',
  'src/frontend/app/ui/duplicates/',
  'src/frontend/app/model/backendtext.service.ts', // job and messenger texts of the settings page
  'src/common/config/',
];
// ids of reviewed units (also those that stay the same as the English on purpose: FPS, OpenStreetMap, ...)
const reviewedPath = (lang) => resolve(dirname(fileURLToPath(import.meta.url)), `translation-reviewed.${lang}.json`);
const readReviewed = (lang) => {
  try {
    return new Set(JSON.parse(readFileSync(reviewedPath(lang), 'utf8')));
  } catch {
    return new Set();
  }
};

const args = process.argv.slice(2);
const command = args[0];
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : args[i + 1];
};
const lang = opt('lang', 'hu');
const xlfRel = `src/frontend/translate/messages.${lang}.xlf`;
const xlfPath = resolve(root, xlfRel);

const UNIT_RE = /<trans-unit id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
const PLACEHOLDER_RE = /<x [^>]*\/>/g;

const decode = (s) => mapText(s, (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'').replace(/&amp;/g, '&'));
const encode = (s) => mapText(s, (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
// applies fn to the text between the <x .../> placeholders
function mapText(s, fn) {
  const tags = s.match(PLACEHOLDER_RE) || [];
  return s.split(PLACEHOLDER_RE).map((part, i) => fn(part) + (tags[i] || '')).join('');
}
const placeholders = (s) => (s.match(PLACEHOLDER_RE) || []).map((t) => (t.match(/id="([^"]*)"/) || [])[1]).sort().join(',');

function parse(xml) {
  const units = new Map();
  for (const m of xml.matchAll(UNIT_RE)) {
    const body = m[2];
    units.set(m[1], {
      id: m[1],
      source: (body.match(/<source>([\s\S]*?)<\/source>/) || [])[1] ?? '',
      target: (body.match(/<target>([\s\S]*?)<\/target>/) || [])[1],
      files: [...new Set([...body.matchAll(/context-type="sourcefile">([^<]+)</g)].map((f) => f[1]))],
    });
  }
  return units;
}

function exportUnits() {
  const since = opt('since', null) ??
    execFileSync('git', ['describe', '--tags', '--abbrev=0'], {cwd: root, encoding: 'utf8'}).trim();
  const withAdmin = args.includes('--with-admin');
  const units = parse(readFileSync(xlfPath, 'utf8'));
  const reviewed = readReviewed(lang);
  let old = new Map();
  try {
    old = parse(execFileSync('git', ['show', `${since}:${xlfRel}`], {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}));
  } catch {
    console.error(`No ${xlfRel} at ${since}; only listing untranslated units.`);
  }

  const out = [];
  let skippedAdmin = 0;
  for (const u of units.values()) {
    if (reviewed.has(u.id)) {
      continue;
    }
    const reasons = [];
    const before = old.get(u.id);
    if (old.size && !before) {
      reasons.push('new');
    } else if (before && before.source !== u.source) {
      reasons.push('source changed');
    }
    if (u.target === undefined || u.target.trim() === '' || u.target === u.source) {
      reasons.push('untranslated');
    }
    if (!reasons.length) {
      continue;
    }
    const adminOnly = u.files.length > 0 && u.files.every((f) => ADMIN_PATHS.some((p) => f.startsWith(p)));
    if (adminOnly && !withAdmin) {
      skippedAdmin++;
      continue;
    }
    out.push({
      id: u.id,
      reason: reasons.join(', '),
      where: u.files.map((f) => f.replace(/^src\/(frontend\/app\/)?/, '')).join(' '),
      source: decode(u.source),
      target: decode(u.target ?? ''),
    });
  }
  const json = JSON.stringify(out, null, 1) + '\n';
  const outFile = opt('out', null);
  if (outFile) {
    writeFileSync(outFile, json);
  } else {
    process.stdout.write(json);
  }
  console.error(`${out.length} of ${units.size} units to review (since ${since}); skipped ${skippedAdmin} admin-only units.`);
}

function applyUnits() {
  const file = args[1];
  if (!file || file.startsWith('--')) {
    throw new Error('usage: apply <file.json> [--lang hu]');
  }
  const reviewed = JSON.parse(readFileSync(file, 'utf8'));
  let xml = readFileSync(xlfPath, 'utf8');
  const units = parse(xml);
  const wanted = new Map(reviewed.map((r) => [r.id, r.target]));
  const errors = [];
  let changed = 0;
  for (const [id, target] of wanted) {
    const u = units.get(id);
    if (!u) {
      errors.push(`${id}: no such unit`);
    } else if (typeof target !== 'string' || !target.trim()) {
      errors.push(`${id}: empty target`);
    } else if (placeholders(target) !== placeholders(u.source)) {
      errors.push(`${id}: placeholders differ from the source (${placeholders(u.source) || 'none'})`);
    }
  }
  if (errors.length) {
    throw new Error('Nothing written:\n' + errors.join('\n'));
  }
  xml = xml.replace(UNIT_RE, (whole, id, body) => {
    if (!wanted.has(id)) {
      return whole;
    }
    const target = encode(wanted.get(id));
    if (units.get(id).target === target) {
      return whole;
    }
    changed++;
    const newBody = /<target>[\s\S]*?<\/target>/.test(body) ?
      body.replace(/<target>[\s\S]*?<\/target>/, () => `<target>${target}</target>`) :
      body.replace(/(\n\s*)$/, (end) => `\n        <target>${target}</target>${end}`);
    return whole.replace(body, () => newBody);
  });
  writeFileSync(xlfPath, xml);
  // remember what was reviewed (and forget ids that are no longer in the file), so the next export skips them
  const allReviewed = new Set([...readReviewed(lang), ...wanted.keys()].filter((id) => units.has(id)));
  writeFileSync(reviewedPath(lang), JSON.stringify([...allReviewed].sort(), null, 1) + '\n');
  console.error(`Updated ${changed} of ${wanted.size} units in ${xlfRel}; ${allReviewed.size} ids in ${reviewedPath(lang)}.`);
}

if (command === 'export') {
  exportUnits();
} else if (command === 'apply') {
  applyUnits();
} else {
  console.error('usage: translation-review.mjs export|apply ... (see the header of this file)');
  process.exit(1);
}
