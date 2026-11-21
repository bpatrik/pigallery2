import {Component, input} from '@angular/core';
import {Config} from '../../common/config/public/Config';
import {SVGIconConfig} from '../../common/config/public/ClientConfig';
import { SafeHtmlPipe } from './pipes/SafeHTMLPipe';

@Component({
    selector: 'app-icon',
    styles: [':host {line-height: 0}'],
    template: `
      <svg xmlns="http://www.w3.org/2000/svg"
           style="vertical-align: baseline"
           [attr.width]="width()"
           [attr.height]="height()"
           fill="currentcolor"
           [attr.viewBox]="icon().viewBox || '0 0 512 512'"
           [innerHtml]="icon().items | safeHtml">
      </svg>`,
    imports: [SafeHtmlPipe]
})
export class IconComponent {

  readonly width = input<number>();
  readonly height = input<number>();
  // the icon of the gallery (Server.svgIcon) by default
  readonly icon = input<SVGIconConfig>(Config.Server.svgIcon);

}
