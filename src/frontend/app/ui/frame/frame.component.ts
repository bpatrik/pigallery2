import { Component, ElementRef, ViewEncapsulation, computed, inject, input, viewChild } from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthenticationService} from '../../model/network/authentication.service';
import {UserRoles} from '../../../../common/entities/UserDTO';
import {Config} from '../../../../common/config/public/Config';
import {NotificationService} from '../../model/notification.service';
import {QueryService} from '../../model/query.service';
import {NavigationLinkConfig, NavigationLinkTypes, ScrollUpModes, ThemeModes} from '../../../../common/config/public/ClientConfig';
import {SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';
import {Utils} from '../../../../common/Utils';
import {PageHelper} from '../../model/page.helper';
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from 'ngx-bootstrap/dropdown';
import {LanguageComponent} from '../language/language.component';
import {ThemeService} from '../../model/theme.service';
import {DeviceHelper} from '../../model/device.helper';
import {LoadingBarModule} from '@ngx-loading-bar/core';
import {IconComponent} from '../../icon.component';

import {GallerySearchComponent} from '../gallery/search/search.gallery.component';
import {GalleryShareComponent} from '../gallery/share/share.gallery.component';
import {NgIconComponent} from '@ng-icons/core';
import {FormsModule} from '@angular/forms';
import {GalleryService} from '../gallery/gallery.service';
import {UploaderService} from '../gallery/uploader/uploader.service';
import {SearchQueryUtils} from '../../../../common/SearchQueryUtils';
import {NavigationService} from '../../model/navigation.service';

// a navbar link with its state
export interface NavbarLinkItem {
  link: NavigationLinkConfig;
  active: boolean;
  // the /search route parameter of a search link
  searchUrl?: string;
}

@Component({
  selector: 'app-frame',
  host: {
    '(window:scroll)': 'onScroll()'
  },
  templateUrl: './frame.component.html',
  styleUrl: './frame.component.css',
  encapsulation: ViewEncapsulation.Emulated,
  imports: [
    LoadingBarModule,
    RouterLink,
    IconComponent,
    GallerySearchComponent,
    GalleryShareComponent,
    NgIconComponent,
    LanguageComponent,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective,
    FormsModule
],
})
export class FrameComponent {
  private authService = inject(AuthenticationService);
  notificationService = inject(NotificationService);
  queryService = inject(QueryService);
  private navigationService = inject(NavigationService);
  themeService = inject(ThemeService);
  galleryService = inject(GalleryService);
  uploadService = inject(UploaderService);

  readonly showSearch = input(false);
  readonly showShare = input(false);
  public readonly user = this.authService.user;
  public readonly isAdmin = this.authService.isAdmin;
  public readonly authenticationRequired = Config.Users.authenticationRequired;
  public readonly title = Config.Server.applicationTitle;
  public readonly navbarLinks = Config.Gallery.NavBar.links;
  public readonly NavigationLinkTypes = NavigationLinkTypes;
  public readonly stringify = JSON.stringify;
  public readonly themesEnabled = Config.Gallery.Themes.enabled;
  public readonly svgIcon = Config.Server.svgIcon;
  public shouldHideNavbar = false;
  public navbarKeepTop = true;
  public animateNavbar = false;
  public fixNavbarOnTop = false;
  readonly dropdownMenu = viewChild<ElementRef>('dropdownMenu');
  readonly navContainer = viewChild.required<ElementRef>('navContainer');
  readonly dropdown = viewChild<BsDropdownDirective>('dropdown');
  readonly languageSelector = viewChild<LanguageComponent>('languageSelector');
  ThemeModes = ThemeModes;
  public readonly enableScrollUpButton: boolean;
  /* sticky top navbar */
  private lastScroll = {
    any: 0,
    up: 0,
    down: 0
  };

  public readonly isFacesAvailable = computed((): boolean =>
    Config.Faces.enabled &&
    this.authService.isAuthorized(Config.Faces.readAccessMinRole)
  );

  public readonly isGalleryAvailable = computed((): boolean =>
    this.authService.isAuthorized(UserRoles.User)
  );

  public readonly isCustomLinksAvailable = computed((): boolean =>
    this.authService.isAuthorized(UserRoles.User)
  );

  public readonly isAlbumsAvailable = computed((): boolean =>
    Config.Album.enabled &&
    this.authService.isAuthorized(Config.Album.readAccessMinRole)
  );

  // the navbar links with their active state, that follows the url
  public readonly navbarLinkItems = computed((): NavbarLinkItem[] => {
    const url = this.navigationService.url();
    return this.navbarLinks.map((link): NavbarLinkItem => {
      switch (link.type) {
        case NavigationLinkTypes.albums:
          return {link, active: url.startsWith('/albums')};
        case NavigationLinkTypes.faces:
          return {link, active: url.startsWith('/faces')};
        case NavigationLinkTypes.gallery:
          return {link, active: url.startsWith('/gallery')};
        case NavigationLinkTypes.url:
          return {link, active: !!link.url && url.startsWith(link.url)};
        case NavigationLinkTypes.search:
          return {
            link,
            active: !!link.SearchQuery && FrameComponent.isSearchActive(url, link.SearchQuery),
            searchUrl: link.SearchQuery ? SearchQueryUtils.urlify(link.SearchQuery) : undefined
          };
        default:
          return {link, active: false};
      }
    });
  });

  constructor() {
    this.enableScrollUpButton = Config.Gallery.NavBar.showScrollUpButton === ScrollUpModes.always || (Config.Gallery.NavBar.showScrollUpButton === ScrollUpModes.mobileOnly && DeviceHelper.isTouchDevice());
  }

  private static isSearchActive(url: string, searchQuery: SearchQueryDTO): boolean {
    if (!url.startsWith('/search')) {
      return false;
    }
    try {
      const rawUrl = url.substring('/search/'.length);
      const sq = JSON.parse(decodeURIComponent(rawUrl)) as SearchQueryDTO;
      return sq.type == searchQuery.type && Utils.equalsFilter(sq, searchQuery);
    } catch {
      // ignored
    }
    return false;
  }

  logout(): void {
    this.authService.logout();
  }

  onScroll(): void {
    const scrollPosition = PageHelper.ScrollY;
    const up = this.lastScroll.any > scrollPosition;
    const down = this.lastScroll.any < scrollPosition;
    const upDelay = up && this.lastScroll.down > scrollPosition + window.innerHeight * Config.Gallery.NavBar.NavbarShowDelay;
    const downDelay = down && this.lastScroll.up < scrollPosition - window.innerHeight * Config.Gallery.NavBar.NavbarHideDelay;
    // We are the top where the navbar by default lives
    if (this.navContainer().nativeElement.offsetHeight > scrollPosition) {
      // do not force move navbar up when we are scrolling up from bottom
      if (this.shouldHideNavbar != false || scrollPosition <= 0) {
        this.navbarKeepTop = true;
      }
      if (down) { // scroll down
        this.shouldHideNavbar = true;
      }

    } else {
      // enable navigation once we left the top part to prevent hide extra animation
      this.animateNavbar = !(this.navbarKeepTop && down);
      this.navbarKeepTop = false;

      if (downDelay) { // scroll down
        this.dropdown()?.hide();
        this.languageSelector()?.dropdown()?.hide();
      }
    }

    if (upDelay) { //scroll up
      this.shouldHideNavbar = false;
    } else if (downDelay) { // scroll down
      this.shouldHideNavbar = true;
    }

    if (up) { //scroll up
      this.lastScroll.up = scrollPosition;
    } else if (down) { // scroll down
      this.lastScroll.down = scrollPosition;
    }

    this.lastScroll.any = scrollPosition;
  }

  scrollUp(): void {
    PageHelper.ScrollY = 0;
  }

}

