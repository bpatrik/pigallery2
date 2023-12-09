import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {TempFolderCleaningJob} from './TempFolderCleaningJob';
import {GPXProcessing} from '../../fileaccess/fileprocessing/GPXProcessing';

/**
 * Deletes all gpx file from the tmp folder
 */
export class GPXCompressionResetJob extends TempFolderCleaningJob {
  public readonly Name = DefaultsJobs[DefaultsJobs['Delete Compressed GPX']];

  // returns false if the file is GPX
  protected async isValidFile(filePath: string): Promise<boolean> {
    return !GPXProcessing.isGPXFile(filePath);
  }

}
