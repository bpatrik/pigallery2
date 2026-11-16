import {Component, OnInit, computed, inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {NgIconComponent} from '@ng-icons/core';
import {FrameComponent} from '../frame/frame.component';
import {IconComponent} from '../../icon.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ReleaseNotesService} from '../../model/release-notes.service';
import {PiTitleService} from '../../model/pi-title.service';
import {NotificationService} from '../../model/notification.service';
import {CopyDirective} from '../utils/copy/copy.directive';
import {Config} from '../../../../common/config/public/Config';
import {ClientServiceConfig} from '../../../../common/config/public/ClientConfig';

/**
 * What PiGallery2 is and how to support it. Only admins see the running version (see BuildInfoDTO).
 */
@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
  imports: [FrameComponent, IconComponent, NgIconComponent, DatePipe, CopyDirective]
})
export class AboutComponent implements OnInit {
  private authService = inject(AuthenticationService);
  private piTitleService = inject(PiTitleService);
  private notification = inject(NotificationService);
  readonly releaseNotesService = inject(ReleaseNotesService);

  readonly isAdmin = this.authService.isAdmin;
  readonly hideSponsorLinks = Config.Server.hideSponsorLinks;
  readonly releasesUrl = ReleaseNotesService.ReleasesUrl;
  // PiGallery2's own icon, also when the gallery has a custom one (Server.svgIcon)
  readonly appIcon = new ClientServiceConfig().svgIcon;
  readonly build = computed(() => this.releaseNotesService.notes()?.build ?? null);
  readonly hasNotes = computed((): boolean => !!this.releaseNotesService.notes()?.notes);
  // shortened like GitHub does
  readonly commit = computed((): { short: string, url: string } | null => {
    const hash = this.build()?.buildCommitHash;
    return hash ? {short: hash.substring(0, 7), url: 'https://github.com/bpatrik/pigallery2/commit/' + hash} : null;
  });
  // e.g.: Node.js v22.11.0 · linux/arm64 · Docker
  readonly runtime = computed((): string => {
    const build = this.build();
    return build ? ['Node.js ' + build.nodeVersion, build.platform, ...(build.isDocker ? ['Docker'] : [])].join(' · ') : '';
  });
  // plain English text for a GitHub issue, not translated
  readonly bugReportText = computed((): string => {
    const build = this.build();
    if (!build) {
      return '';
    }
    return [
      'PiGallery2 v' + build.appVersion,
      build.buildCommitHash ? 'Commit: ' + build.buildCommitHash : null,
      build.buildTime ? 'Built at: ' + build.buildTime : null,
      'Runs on: ' + this.runtime(),
    ].filter((l): l is string => l !== null).join('\n');
  });

  onBuildInfoCopied(): void {
    this.notification.success($localize`The build info has been copied to the clipboard`);
  }

  ngOnInit(): void {
    this.piTitleService.setTitle($localize`About`);
  }
}
