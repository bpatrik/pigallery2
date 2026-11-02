import {inject, TestBed} from '@angular/core/testing';
import {BackendtextService} from './backendtext.service';
import {backendTexts} from '../../../common/BackendTexts';
import {Utils} from '../../../common/Utils';
import {DefaultsJobs} from '../../../common/entities/job/JobDTO';

describe('BackendTextService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BackendtextService],
    });
  });

  it('should have valid text for all keys', inject(
    [BackendtextService],
    (backendTextService: BackendtextService) => {
      const getTexts = (obj: any) => {
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'object') {
            getTexts(obj[key]);
            continue;
          }
          expect(backendTextService.get(obj[key]), 'Error for key: ' + obj[key] + ', ' + key).not.toEqual(null);
        }
      };
      getTexts(backendTexts);
    }
  ));

  it('should have valid text for all jobs', inject(
    [BackendtextService],
    (backendTextService: BackendtextService) => {

      const allJobs = Utils.enumToArray(DefaultsJobs);

      for (let i = 0; i < allJobs.length; ++i){
        expect(backendTextService.getJobName(allJobs[i].value), 'Cant find job name: ' + allJobs[i].value).not.toEqual(null);
        expect(backendTextService.getJobDescription(allJobs[i].value), 'Cant find job name: ' + allJobs[i].value).not.toEqual(null);
      }
    }
  ));
});
