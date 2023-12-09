import * as fs from 'fs';

declare const process: { argv: string[] };


const dir = process.argv[2];

if (fs.existsSync(dir)) {
  console.log('deleting folder:' + dir);
  fs.rmSync(dir, {recursive: true});
}
console.log('creating folder:' + dir);
fs.mkdirSync(dir);

