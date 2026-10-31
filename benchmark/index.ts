import 'reflect-metadata';
import {Config} from '../src/common/config/private/Config';
import {ProjectPath} from '../src/backend/ProjectPath';
import {BenchmarkResult, BenchmarkRunner} from './BenchmarkRunner';
import {Utils} from '../src/common/Utils';
import {BMConfig} from './BMConfig';
import {DirectoryDTOUtils} from '../src/common/entities/DirectoryDTO';


Config.Media.folder = BMConfig.path;
ProjectPath.reset();
const RUNS = BMConfig.RUNS;

let resultsText = '';
const printLine = (text: string) => {
  resultsText += text + '\n';
};


const printHeader = async (statistic: string) => {
  const dt = new Date();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  printLine('## PiGallery2 v' + require('./../package.json').version +
    ', ' + Utils.zeroPrefix(dt.getDate(), 2) +
    '.' + Utils.zeroPrefix(dt.getMonth() + 1, 2) +
    '.' + dt.getFullYear());
  if (Config.Environment && Config.Environment.buildCommitHash) {
    printLine('**Version**: v' + Config.Environment.appVersion + ', built at: ' + new Date(Config.Environment.buildTime) + ', git commit:' + Config.Environment.buildCommitHash);
  }
  printLine('**System**: ' + BMConfig.system);
  printLine('\n**Gallery**: ' + statistic + '\n');
};


const printTableHeader = () => {
  printLine('| Action | Sub action | Average Duration | Result  |');
  printLine('|:------:|:----------:|:----------------:|:-------:|');
};
const printExperimentResult = (result: BenchmarkResult, isSubResult = false) => {
  console.log('benchmarked: ' + result.name);

  const fileSize = (size: number): string => {
    const postFixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    while (size > 1000 && index < postFixes.length - 1) {
      size /= 1000;
      index++;
    }
    return size.toFixed(2) + postFixes[index];
  };
  let details = '-';
  if (result.items) {
    details = 'items: ' + result.items.length +
      ', size: ' + fileSize(JSON.stringify(result.items).length);
  }
  if (result.contentWrapper) {
    if (result.contentWrapper.directory) {
      details = 'media: ' + result.contentWrapper.directory.media.length +
        ', directories: ' + result.contentWrapper.directory.directories.length +
        ', size: ' + fileSize(JSON.stringify(DirectoryDTOUtils.removeReferences(result.contentWrapper.directory)).length);
    } else {
      details = 'media: ' + result.contentWrapper.searchResult.media.length +
        ', directories: ' + result.contentWrapper.searchResult.directories.length +
        ', size: ' + fileSize(JSON.stringify(result.contentWrapper.searchResult).length);

    }
  }
  if (isSubResult) {
    printLine('| | ' + result.name + ' | ' + (result.duration).toFixed(1) + ' ms | ' + details + ' |');
  } else {
    printLine('| **' + (result.experiment ? '`[' + result.experiment + ']`' : '') + result.name + '** | | **' + (result.duration).toFixed(1) + ' ms** | **' + details + '** |');
  }
  if (result.subBenchmarks && result.subBenchmarks.length > 1) {
    for (const item of result.subBenchmarks) {
      printExperimentResult(item, true);
    }
  }
};


const printResult = (results: BenchmarkResult[]) => {
  for (const result of results) {
    printExperimentResult(result);
  }
};

const run = async () => {
  console.log('Running, RUNS:' + RUNS);
  const start = Date.now();
  const bm = new BenchmarkRunner(RUNS);

  // header
  await printHeader(await bm.getStatistic());
  printTableHeader();
  if (BMConfig.Benchmarks.bmScanDirectory) {
    printResult(await bm.bmScanDirectory());
  }
  if (BMConfig.Benchmarks.bmSaveDirectory) {
    printResult(await bm.bmSaveDirectory());
  }

  if (BMConfig.Benchmarks.bmListDirectory) {
    printResult(await bm.bmListDirectory());
  }

  if (BMConfig.Benchmarks.bmListPersons) {
    printResult(await bm.bmListPersons());
  }

  if (BMConfig.Benchmarks.bmAllSearch) {
    (await bm.bmAllSearch()).forEach(res => printResult(res.result));
  }

  if (BMConfig.Benchmarks.bmAutocomplete) {
    printResult(await bm.bmAutocomplete('a'));
  }
  printLine('*Measurements run ' + RUNS + ' times and an average was calculated.');
  console.log(resultsText);
  console.log('run for : ' + ((Date.now() - start)).toFixed(1) + 'ms');
};

run().then(console.log).catch(console.error);

