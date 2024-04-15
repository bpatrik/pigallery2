import {createTransport, Transporter} from 'nodemailer';
import {Config} from '../../../common/config/private/Config';
import {PhotoMetadata} from '../../../common/entities/PhotoDTO';
import {MediaDTOWithThPath, Messenger} from './Messenger';
import {backendTexts} from '../../../common/BackendTexts';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';
import {DefaultMessengers} from '../../../common/entities/job/JobDTO';
import {Utils} from '../../../common/Utils';

export class EmailMessenger extends Messenger<{
  emailTo: string,
  emailSubject: string,
  emailText: string,
}> {
  public readonly Name = DefaultMessengers[DefaultMessengers.Email];
  public readonly ConfigTemplate: DynamicConfig[]  = [{
    id: 'emailTo',
    type: 'string-array',
    name: backendTexts.emailTo.name,
    description: backendTexts.emailTo.description,
    defaultValue: [],
  }, {
    id: 'emailSubject',
    type: 'string',
    name: backendTexts.emailSubject.name,
    description: backendTexts.emailSubject.description,
    defaultValue: 'Latest photos for you',
  }, {
    id: 'emailText',
    type: 'string',
    name: backendTexts.emailText.name,
    description: backendTexts.emailText.description,
    defaultValue: 'I hand picked these photos just for you:',
  }];
  transporter: Transporter;

  constructor() {
    super();
    this.transporter = createTransport({
      host: Config.Messaging.Email.smtp.host,
      port: Config.Messaging.Email.smtp.port,
      secure: Config.Messaging.Email.smtp.secure,
      requireTLS: Config.Messaging.Email.smtp.requireTLS,
      auth: {
        user: Config.Messaging.Email.smtp.user,
        pass: Config.Messaging.Email.smtp.password
      }
    });
  }


  protected async sendMedia(mailSettings: {
    emailTo: string,
    emailSubject: string,
    emailText: string
  }, media: MediaDTOWithThPath[]) {

    const attachments = [];
    const htmlStart = '<h1 style="text-align: center; margin-bottom: 2em">' + Config.Server.applicationTitle + '</h1>\n' +
      '<h3>' + mailSettings.emailText + '</h3>\n' +
      '<table style="margin-left: auto;  margin-right: auto;">\n' +
      '  <tbody>\n';
    const htmlEnd = '  </tr>\n' +
      '  </tbody>\n' +
      '</table>';
    let htmlMiddle = '';
    const numberOfColumns = media.length >= 6 ? 3 : 2;
    for (let i = 0; i < media.length; ++i) {
      const location = (media[i].metadata as PhotoMetadata).positionData?.country ?
        (media[i].metadata as PhotoMetadata).positionData?.country :
        ((media[i].metadata as PhotoMetadata).positionData?.city ?
          (media[i].metadata as PhotoMetadata).positionData?.city : '');
      const caption = Utils.getFullYear(media[i].metadata.creationDate, media[i].metadata.creationDateOffset) + (location ? ', ' + location : '');
      attachments.push({
        filename: media[i].name,
        path: media[i].thumbnailPath,
        cid: 'img' + i
      });
      if (i % numberOfColumns == 0) {
        htmlMiddle += '<tr>';
      }
      htmlMiddle += '<td>\n' +
        '      <a style="display: block;text-align: center;" href="' + media[i].thumbnailUrl + '"><img alt="' + media[i].name + '" style="max-width: 200px; max-height: 150px;  height:auto; width:auto;" src="cid:img' + i + '"/></a>\n' +
        caption +
        '    </td>\n';

      if (i % numberOfColumns == (numberOfColumns - 1) || i === media.length - 1) {
        htmlMiddle += '</tr>';
      }
    }

    return await this.transporter.sendMail({
      from: Config.Messaging.Email.emailFrom,
      to: mailSettings.emailTo,
      subject: mailSettings.emailSubject,
      html: htmlStart + htmlMiddle + htmlEnd,
      attachments: attachments
    });
  }
}
