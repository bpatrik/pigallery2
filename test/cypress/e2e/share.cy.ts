// The e2e server serves the demo/images folder.
// timestamps has big_ben.jpg, dupl is an other directory next to it (without big_ben.jpg).
const SEARCH_FILE_NAME = 103; // SearchQueryTypes.file_name
const EXACT_MATCH = 1; // TextSearchQueryMatchTypes.exact_match

// directory listing only, not the media (e.g.: content/dir/photo.jpg/320)
const contentUrl = /\/pgapi\/gallery\/content\/(?![^?]*\.\w+\/\d+)/;

const login = () => {
  cy.visit('/');
  cy.get('.card-body');
  cy.get('.col-sm-12').contains('Login');
  cy.get('#username').type('admin');
  cy.get('#password').clear();
  cy.get('#password').type('admin');
  cy.intercept({
    method: 'Get',
    url: '/pgapi/gallery/content/',
  }).as('getContent');
  cy.get('.col-sm-12 > .btn').click();
  cy.wait('@getContent');
};

/**
 * Intercepts the requests without caching, so the server always answers with the content.
 */
const interceptNoCache = (alias: string, url: string | RegExp) => {
  cy.intercept({
    method: 'Get',
    url,
  }, (req) => {
    // Remove caching headers to force a 200 OK response from the server
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
  }).as(alias);
};

const expectContent = (alias: string) => {
  cy.wait('@' + alias).then((interception) => {
    expect(interception.response.statusCode).to.eq(200);
    assert.isNotNull(interception.response.body, 'API call has data');
    assert.notExists(interception.response.body?.error, 'API call has no error: ' + JSON.stringify(interception.response.body?.error) + ' ' + interception.request.url);
  });
};

const openDirectory = (dir: string) => {
  interceptNoCache('getDirectory', contentUrl);
  cy.visit('/gallery/' + dir);
  expectContent('getDirectory');
};

/**
 * Creates a sharing from the share dialog of the current view and returns its link.
 */
const createSharing = (options: { password?: string, recursive?: boolean } = {}): Cypress.Chainable<string> => {
  cy.get('button#shareButton').click();
  // the dialog keeps its settings while the page is open
  cy.get('body').then(($body) => {
    if ($body.find('input#share-recursive').length > 0) {
      cy.get('input#share-recursive')[options.recursive ? 'check' : 'uncheck']({force: true});
    }
  });
  if (options.password) {
    cy.get('input#share-password').type(options.password, {force: true});
  }
  cy.get('button#getShareButton').click();
  cy.get('input#shareLink').should('contain.value', 'http');
  return cy.get('input#shareLink').invoke('val').then((link) => {
    // the "copied to clipboard" toast has a close button too
    cy.get('modal-container button.btn-close').click();
    return cy.wrap(link as unknown as string);
  });
};

const logout = () => {
  cy.get('button#button-frame-menu').click();
  cy.get('#dropdown-frame-menu  ng-icon[name="ionLogOutOutline"]').click({scrollBehavior: false});
};

const getSharingKey = (link: string) => new URL(link).pathname.split('/').pop();

/**
 * Opens a sharing without password as a guest (not logged in user).
 */
const openSharingAsGuest = (link: string, alias: string, url: string | RegExp) => {
  logout();
  cy.get('#username');
  interceptNoCache(alias, url);
  cy.visit(link);
  cy.get('app-gallery', {timeout: 15000}).should('exist');
  expectContent(alias);
};

describe('Share', () => {
  beforeEach(() => {
    cy.viewport(1200, 600);
    login();
  });

  describe('Directory sharing', () => {

    it('Open no password sharing', () => {
      openDirectory('timestamps');
      createSharing().then((link) => {
        openSharingAsGuest(link, 'getSharedContent', contentUrl);

        cy.url().should('include', '/gallery/timestamps');
        cy.get('.photo-container > img[alt="big_ben.jpg"]');
        // the parents are shown, but they can't be opened
        cy.get('#directory-path li').first().find('a').should('not.exist');
        cy.get('#directory-path li').last().should('contain.text', 'timestamps');
      });
    });

    it('Open password protected sharing', () => {
      openDirectory('timestamps');
      createSharing({password: 'secret'}).then((link) => {
        logout();
        interceptNoCache('getSharedContent', contentUrl);
        cy.visit('/shareLogin?sk=' + getSharingKey(link));
        cy.get('input#password').type('secret');
        cy.get('button#button-share-login').click();

        cy.get('app-gallery', {timeout: 15000}).should('exist');
        expectContent('getSharedContent');
        cy.url().should('include', '/gallery/timestamps');
        cy.get('.photo-container > img[alt="big_ben.jpg"]');
      });
    });

    it('Open password protected sharing with logged in user', () => {
      openDirectory('timestamps');
      createSharing({password: 'secret'}).then((link) => {
        interceptNoCache('getSharedContent', contentUrl);
        cy.visit(link);

        cy.get('.mb-0 > :nth-child(1) > .nav-link').contains('Gallery');
        expectContent('getSharedContent');
        cy.url().should('include', '/gallery/timestamps');
      });
    });

    it('Sharing without subfolders should not open subfolders', () => {
      createSharing().then((link) => {
        openSharingAsGuest(link, 'getSharedContent', contentUrl);

        cy.get('.photo-container > img[alt="IMG_5910.jpg"]');
        cy.get('app-gallery-directory').should('not.exist');
        // not available directories look like not existing ones
        cy.request({url: '/pgapi/gallery/content/timestamps', failOnStatusCode: false})
          .its('status').should('eq', 404);
        cy.request({url: '/pgapi/gallery/content/not_existing_dir', failOnStatusCode: false})
          .its('status').should('eq', 404);
        // the app navigates back to the shared directory
        cy.visit('/gallery/timestamps');
        cy.url().should('not.include', 'timestamps');
        cy.get('.photo-container > img[alt="IMG_5910.jpg"]');
      });
    });

    it('Sharing with subfolders should open subfolders', () => {
      createSharing({recursive: true}).then((link) => {
        openSharingAsGuest(link, 'getSharedContent', contentUrl);

        interceptNoCache('getSubDir', /\/pgapi\/gallery\/content\/timestamps/);
        cy.get('app-gallery-directory .directory-name').contains('timestamps').click();
        expectContent('getSubDir');
        cy.get('.photo-container > img[alt="big_ben.jpg"]');
      });
    });

    it('Share dialog should list the sharings with and without subfolders', () => {
      // other tests might have shared this directory already
      cy.request('/pgapi/share/listAll').then((resp) => {
        const before = resp.body.result.filter((s: { directoryQuery?: { value: string } }) =>
          ['timestamps', 'timestamps/*'].includes(s.directoryQuery?.value)).length;

        openDirectory('timestamps');
        createSharing();
        createSharing({recursive: true});

        cy.get('button#shareButton').click();
        cy.get('a.list-shares-button .badge').should('have.text', (before + 2).toString());
        cy.get('a.list-shares-button').click();
        cy.get('modal-container .modal-footer table tbody tr').should('have.length', before + 2);
        cy.get('modal-container .modal-footer table tbody tr').contains('td', 'Yes');
        cy.get('modal-container .modal-footer table tbody tr').contains('td', 'No');
        cy.get('modal-container .modal-footer table tbody tr').first()
          .find('ng-icon[name="ionCopyOutline"]').should('be.visible');

        // the list does not depend on the subfolder switch
        cy.get('input#share-recursive').uncheck({force: true});
        cy.get('modal-container .modal-footer table tbody tr').should('have.length', before + 2);
      });
    });
  });

  describe('Search sharing', () => {
    it('Open search sharing', () => {
      const query = {type: SEARCH_FILE_NAME, value: 'big_ben.jpg', matchType: EXACT_MATCH};
      interceptNoCache('getSearch', '/pgapi/search/*');
      cy.visit('/search/' + encodeURIComponent(JSON.stringify(query)));
      expectContent('getSearch');

      createSharing().then((link) => {
        openSharingAsGuest(link, 'getSharedContent', '/pgapi/search/*');

        cy.url().should('include', '/search/');
        cy.get('.photo-container > img[alt="big_ben.jpg"]');
        // only the directories with shared photos (and their parents) can be opened
        cy.request({url: '/pgapi/gallery/content/timestamps', failOnStatusCode: false})
          .its('status').should('eq', 200);
        cy.request({url: '/pgapi/gallery/content/', failOnStatusCode: false})
          .its('status').should('eq', 200);
        cy.request({url: '/pgapi/gallery/content/dupl', failOnStatusCode: false})
          .its('status').should('eq', 404);
      });
    });
  });

  describe('Logout', () => {
    it('Logout from no password sharing should go to the login page', () => {
      openDirectory('timestamps');
      createSharing().then((link) => {
        openSharingAsGuest(link, 'getSharedContent', contentUrl);

        logout();
        cy.url().should('include', '/login');
        cy.url().should('not.include', 'shareLogin');
        cy.get('#username');
        // the sharing is dropped
        cy.visit('/');
        cy.url().should('include', '/login');
        cy.get('#username');
      });
    });

    it('Logout from password protected sharing should go to the sharing login', () => {
      openDirectory('timestamps');
      createSharing({password: 'secret'}).then((link) => {
        logout();
        cy.visit('/shareLogin?sk=' + getSharingKey(link));
        cy.get('input#password').type('secret');
        cy.get('button#button-share-login').click();
        cy.get('app-gallery', {timeout: 15000}).should('exist');

        logout();
        cy.url().should('include', '/shareLogin');
        cy.get('input#password');
      });
    });
  });
});
