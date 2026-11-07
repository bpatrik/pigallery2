import * as fs from 'node:fs';

declare const process: { argv: string[] };


const dir = process.argv[2];

if(dir === 'test'){
  throw new Error('test folder is not allowed to be deleted');
}
if(dir === '--exclude'){
  throw new Error('--exclude folder is not allowed to be deleted/created');
}
if (fs.existsSync(dir)) {
  console.log('deleting folder:' + dir);
  fs.rmSync(dir, {recursive: true});
}
console.log('creating folder:' + dir);
fs.mkdirSync(dir);

