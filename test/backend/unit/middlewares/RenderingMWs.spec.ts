import * as path from 'path';
import {expect} from 'chai';
import {RenderingMWs} from '../../../../src/backend/middlewares/RenderingMWs';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ErrorCodes, ErrorDTO} from '../../../../src/common/entities/Error';

declare const describe: any;
declare const it: any;

describe('RenderingMWs', () => {

  const render = (filePath: string): { sent: string, error: ErrorDTO } => {
    const result = {sent: null as string, error: null as ErrorDTO};
    const req: any = {resultPipe: filePath};
    const res: any = {
      set: (): void => undefined,
      sendFile: (p: string): void => {
        result.sent = p;
      }
    };
    RenderingMWs.renderFile(req, res, (err?: any) => {
      result.error = err;
    });
    return result;
  };

  describe('renderFile', () => {
    it('should send files from the media and temp folders', () => {
      const photo = path.join(ProjectPath.ImageFolder, 'dir', 'photo.jpg');
      const thumbnail = path.join(ProjectPath.TranscodedFolder, 'thumb.webp');
      expect(render(photo)).to.deep.equal({sent: path.resolve(photo), error: null});
      expect(render(thumbnail)).to.deep.equal({sent: path.resolve(thumbnail), error: null});
    });

    it('should not send files outside of the media and temp folders', () => {
      for (const p of [
        path.join(ProjectPath.ImageFolder, '..', 'secret.txt'),
        ProjectPath.ImageFolder + '-other' + path.sep + 'photo.jpg',
        path.resolve('/etc/passwd')
      ]) {
        const result = render(p);
        expect(result.sent).to.equal(null);
        expect(result.error.code).to.equal(ErrorCodes.PATH_ERROR);
      }
    });
  });
});
