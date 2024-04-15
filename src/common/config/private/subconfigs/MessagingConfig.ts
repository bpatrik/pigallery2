/* eslint-disable @typescript-eslint/no-inferrable-types */
import {ConfigProperty, SubConfigClass} from 'typeconfig/common';
import {ConfigPriority, TAGS} from '../../public/ClientConfig';

declare let $localize: (s: TemplateStringsArray) => string;

if (typeof $localize === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.$localize = (s) => s;
}


@SubConfigClass<TAGS>({softReadonly: true})
export class EmailSMTPMessagingConfig {
  @ConfigProperty({
    tags: {
      name: $localize`Host`,
      priority: ConfigPriority.advanced,
      hint: 'smtp.example.com'
    },
    description: $localize`SMTP host server`
  })
  host: string = '';

  @ConfigProperty({
    tags: {
      name: $localize`Port`,
      priority: ConfigPriority.advanced,
    },
    description: $localize`SMTP server's port`
  })
  port: number = 587;

  @ConfigProperty({
    tags: {
      name: $localize`isSecure`,
      priority: ConfigPriority.advanced,
    },
    description: $localize`Is the connection secure. See https://nodemailer.com/smtp/#tls-options for more details`
  })
  secure: boolean = false;

  @ConfigProperty({
    tags: {
      name: $localize`TLS required`,
      priority: ConfigPriority.advanced,
    },
    description: $localize`if this is true and secure is false then Nodemailer (used library in the background) tries to use STARTTLS. See https://nodemailer.com/smtp/#tls-options for more details`
  })
  requireTLS: boolean = true;


  @ConfigProperty({
    tags: {
      name: $localize`User`,
      priority: ConfigPriority.advanced,
    },
    description: $localize`User to connect to the SMTP server.`
  })
  user: string = '';


  @ConfigProperty({
    tags: {
      name: $localize`Password`,
      priority: ConfigPriority.advanced,
    },
    type: 'password',
    description: $localize`Password to connect to the SMTP server.`
  })
  password: string = '';

}

@SubConfigClass<TAGS>({softReadonly: true})
export class EmailMessagingConfig {

  @ConfigProperty({
    tags:
        {
          name: $localize`Sender email`,
          priority: ConfigPriority.advanced,
        } as TAGS,
    description: $localize`Some services do not allow sending from random e-mail addresses. Set this accordingly.`
  })
  emailFrom: string = 'noreply@pigallery2.com';

  @ConfigProperty({
    tags:
        {
          name: $localize`SMTP`,
        }
  })
  smtp?: EmailSMTPMessagingConfig = new EmailSMTPMessagingConfig();

}

@SubConfigClass<TAGS>({softReadonly: true})
export class MessagingConfig {
  @ConfigProperty({
    tags:
        {
          name: $localize`Email`,
        },
    description: $localize`The app uses Nodemailer in the background for sending e-mails. Refer to https://nodemailer.com/usage/ if some options are not clear.`
  })
  Email: EmailMessagingConfig = new EmailMessagingConfig();
}
