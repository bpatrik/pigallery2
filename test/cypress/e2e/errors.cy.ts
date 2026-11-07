// Unhappy paths of the critical user journeys (#1254): the user should get a clear message, not an empty or wrong page.

const NOT_EXISTING_SHARING = '/share/doesnotexist';
// what a missing or invalid sharing link should tell the user
const invalidLinkMessage = /not found|invalid|expired|does not exist/i;

const loginAsAdmin = () => {
  cy.request('POST', '/pgapi/user/login', {
    loginCredential: {username: 'admin', password: 'admin', rememberMe: false},
  });
};

describe('Errors', () => {
  beforeEach(() => {
    cy.viewport(1200, 600);
  });

  describe('Not existing sharing link', () => {

    it('should tell a guest that the link is invalid', () => {
      cy.visit(NOT_EXISTING_SHARING);

      cy.contains(invalidLinkMessage, {timeout: 10000});
      // not the generic error page
      cy.contains('Something went spectacularly wrong').should('not.exist');
    });

    it('should tell a logged in user that the link is invalid', () => {
      loginAsAdmin();
      cy.visit(NOT_EXISTING_SHARING);

      cy.contains(invalidLinkMessage, {timeout: 10000});
      // no empty gallery with a broken sharing header
      cy.get('body').should('not.contain.text', 'NaN');
      cy.get('app-gallery-grid').should('not.exist');
    });
  });

  describe('Not existing folder', () => {

    it('should fall back to the root folder with a warning toast', () => {
      const missingDir = 'nem_létező_mappa';
      loginAsAdmin();
      cy.visit('/gallery/' + encodeURIComponent(missingDir));

      // falling back to the root is intended
      cy.location('pathname').should('eq', '/gallery/');
      cy.get('.photo-container > img[alt="IMG_5910.jpg"]');
      // but the user is told why (a warning, not an error)
      cy.contains('app-toast-card[role="status"]', missingDir);
    });
  });

  // The exact design is not decided yet: these only require an icon with an explanation next to it.
  describe('Empty results', () => {

    it('should show an icon and a message in an empty folder', () => {
      loginAsAdmin();
      cy.intercept('GET', '/pgapi/gallery/content/emptydirectory').as('getContent');
      cy.visit('/gallery/emptydirectory');
      cy.wait('@getContent');

      // not /empty/i: the folder name itself contains that word
      cy.contains('app-gallery', /(folder|directory) is empty|no (photos|media|items)/i)
        .should('be.visible')
        .parent().find('ng-icon').should('be.visible');
    });

    it('should show an icon and a message when the search matched nothing', () => {
      const query = 'zzzznomatch';
      loginAsAdmin();
      cy.intercept('GET', '/pgapi/search/*').as('getSearch');
      cy.visit('/search/' + query);
      cy.wait('@getSearch');

      // e.g.: Search result of "zzzznomatch" matched nothing
      cy.contains('app-gallery', new RegExp(query + '.*(matched nothing|no (results|photos|media))', 'i'))
        .should('be.visible')
        .parent().find('ng-icon').should('be.visible');
    });
  });

  describe('Deep link to a not existing photo', () => {

    // Intended: a deleted photo or a stale link falls back to the first photo with an info toast, instead of failing.
    // The photos of a smart photo frame (/frame) can change while it plays; this keeps its slideshow running.
    it('should open the first photo with an info toast', () => {
      loginAsAdmin();
      cy.intercept('GET', '/pgapi/gallery/content/').as('getContent');
      cy.visit('/gallery/?p=not_existing.jpg');
      cy.wait('@getContent');

      cy.location('search').should('eq', '?p=IMG_5910.jpg');
      cy.get('app-gallery-lightbox-media img[alt="IMG_5910.jpg"]').should('be.visible');
      cy.contains('app-toast-card[role="status"]', 'not available');
    });
  });
});
