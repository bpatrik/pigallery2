import {Component, ElementRef, HostListener, Input, ViewChild, ViewEncapsulation} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {AuthenticationService} from '../../model/network/authentication.service';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {Config} from '../../../../common/config/public/Config';
import {BehaviorSubject} from 'rxjs';
import {NotificationService} from '../../model/notification.service';
import {QueryService} from '../../model/query.service';
import {NavigationLinkTypes, ScrollUpModes, ThemeModes} from '../../../../common/config/public/ClientConfig';
import {SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';
import {Utils} from '../../../../common/Utils';
import {PageHelper} from '../../model/page.helper';
import {BsDropdownDirective} from 'ngx-bootstrap/dropdown';
import {LanguageComponent} from '../language/language.component';
import {ThemeService} from '../../model/theme.service';
import {DeviceDetectorService} from 'ngx-device-detector';

@Component({
  selector: 'app-frame',
  templateUrl: './frame.component.html',
  styleUrls: ['./frame.component.css'],
  providers: [RouterLink],
  encapsulation: ViewEncapsulation.Emulated,
})
export class FrameComponent {
  @Input() showSearch = false;
  @Input() showShare = false;
  public readonly user: BehaviorSubject<UserDTO>;
  public readonly authenticationRequired = Config.Users.authenticationRequired;
  public readonly title = Config.Server.applicationTitle;
  public collapsed = true;
  public readonly navbarLinks = Config.Gallery.NavBar.links;
  public readonly NavigationLinkTypes = NavigationLinkTypes;
  public readonly stringify = JSON.stringify;
  public readonly themesEnabled = Config.Gallery.Themes.enabled;
  public readonly svgIcon = Config.Server.svgIcon;

  /* sticky top navbar */
  private lastScroll = {
    any: 0,
    up: 0,
    down: 0
  };
  public shouldHideNavbar = false;
  public navbarKeepTop = true;
  public animateNavbar = false;
  public fixNavbarOnTop = false;
  @ViewChild('navContainer', {static: true}) navContainer: ElementRef;
  @ViewChild('dropdown', {static: true}) dropdown: BsDropdownDirective;
  @ViewChild('languageSelector', {static: true}) languageSelector: LanguageComponent;

  ThemeModes = ThemeModes;
  public readonly enableScrollUpButton: boolean;

  constructor(
      private authService: AuthenticationService,
      public notificationService: NotificationService,
      public queryService: QueryService,
      private router: Router,
      public themeService: ThemeService,
      private deviceService: DeviceDetectorService
  ) {
    this.enableScrollUpButton = Config.Gallery.NavBar.showScrollUpButton === ScrollUpModes.always || (Config.Gallery.NavBar.showScrollUpButton === ScrollUpModes.mobileOnly && !this.deviceService.isDesktop());
    this.user = this.authService.user;
  }

  isAdmin(): boolean {
    return this.user.value && this.user.value.role >= UserRoles.Admin;
  }

  isFacesAvailable(): boolean {
    return (
        Config.Faces.enabled &&
        this.user.value &&
        this.user.value.role >= Config.Faces.readAccessMinRole
    );
  }

  isLinkActive(url: string): boolean {
    return this.router.url.startsWith(url);
  }

  isSearchActive(searchQuery: SearchQueryDTO): boolean {
    if (!this.router.url.startsWith('/search')) {
      return false;
    }
    try {
      const rawUrl = this.router.url.substring('/search/'.length);
      const sq = JSON.parse(decodeURIComponent(rawUrl)) as SearchQueryDTO;
      return sq.type == searchQuery.type && Utils.equalsFilter(sq, searchQuery);
    } catch (e) {
      // ignored
    }
    return false;
  }

  logout(): void {
    this.authService.logout();
  }

  isAlbumsAvailable(): boolean {
    return Config.Album.enabled;
  }


  @HostListener('window:scroll')
  onScroll(): void {
    const scrollPosition = PageHelper.ScrollY;
    const up = this.lastScroll.any > scrollPosition;
    const down = this.lastScroll.any < scrollPosition;
    const upDelay = up && this.lastScroll.down > scrollPosition + window.innerHeight * Config.Gallery.NavBar.NavbarShowDelay;
    const downDelay = down && this.lastScroll.up < scrollPosition - window.innerHeight * Config.Gallery.NavBar.NavbarHideDelay;
    // We are the top where the navbar by default lives
    if (this.navContainer.nativeElement.offsetHeight > scrollPosition) {
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
        this.dropdown.hide();
        this.languageSelector.dropdown.hide();
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

