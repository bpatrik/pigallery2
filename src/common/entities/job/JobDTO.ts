import {DynamicConfig} from '../DynamicConfig';

export enum DefaultsJobs {
  Indexing = 1,
  'Gallery Reset' = 2,
  'Video Converting' = 3,
  'Photo Converting' = 4,
  'Thumbnail Generation' = 5,
  'Temp Folder Cleaning' = 6,
  'Album Cover Filling' = 7,
  'Album Cover Reset' = 8,
  'GPX Compression' = 9,
  'Album Reset' = 10,
  'Delete Compressed GPX' = 11,
  'Top Pick Sending' = 12
}


export enum DefaultMessengers {
  Email = 1,
  Stdout = 2
}


export interface JobDTO {
  Name: string;
  ConfigTemplate: DynamicConfig[];
}

export const JobDTOUtils = {
  getHashName: (jobName: string, config: any = {}) => {
    const sorted = Object.keys(config).sort().reduce((ret, key) => `${ret},${key}:${JSON.stringify(config[key])}`, '');
    return jobName + '-' + JSON.stringify(sorted);
  },
};
