/**
 * These tests are only used for docs screenshot generation
 */
describe('Docs generation', () => {
  beforeEach(() => {
    cy.viewport(1600, 900);
    cy.visit('/');
    cy.get('.card-body');
    cy.get('.col-sm-12').contains('Login');
    /* ==== Generated with Cypress Studio ==== */
    cy.get('#username').type('patrik');
    cy.get('#password').clear();
    cy.get('#password').type('vuc9ep');
    cy.intercept({
      method: 'Get',
      url: '/pgapi/gallery/content/',
    }).as('getContent');
    cy.get('.col-sm-12 > .btn').click();
  });
  it.skip('Main page', () => {
    cy.wait('@getContent');
    cy.wait(1000);
    cy.window().screenshot('main_page', {capture: 'viewport'});
  });
  it.skip('lightbox', () => {
    cy.wait('@getContent');
    cy.visit('/gallery/?p=IMG_4330.jpg');
    cy.get('.photo-container > img[alt="IMG_4330.jpg"]', {timeout: 10000}); //the main photo should be visible
    cy.get('div[title="info key: i"]').click();
    cy.wait(1000);
    cy.window().screenshot('lightbox', {capture: 'viewport'});
  });
  it.skip('Map', () => {
    cy.wait('@getContent');
    cy.get('app-gallery-map').click();
    cy.wait(1000);
    cy.get('div.leaflet-marker-icon span').contains('9').click({force: true});
    cy.wait(500);
    cy.get('img[src="/pgapi/gallery/content/./IMG_4303.jpg/icon"]').click();
    cy.wait(1000);
    cy.window().screenshot('map', {capture: 'viewport'});
  });
  it.skip('Search', () => {
    cy.wait('@getContent');
    cy.get('.search-text').type('2-km-from:"Puerto Rico" and be');
    cy.wait(1000);
    cy.window().screenshot('search', {clip: {x: 200, y: 0, width: 1600 * 2 / 3, height: 900 * 2 / 3}});
  });
  it.skip('Sharing', () => {
    cy.wait('@getContent');
    cy.get('app-gallery-share').click();
    cy.wait(500);
    cy.get('#getShareButton').click();
    cy.wait(2000);
    cy.get('#shareLink').clear({force: true}).type('https://<your domain>/share/c87dbe82', {force: true});
    cy.wait(1000);
    cy.window().screenshot('sharing', {capture: 'viewport'});
  });
  it.skip('filters', () => {
    cy.wait('@getContent');
    cy.get('app-gallery-navbar  ng-icon[name="ionFunnelOutline"]').click({scrollBehavior: false});
    cy.wait(1000);
    cy.window().screenshot('filters', {capture: 'viewport'});
  });
  it.skip('video', () => {
    cy.wait('@getContent');
    cy.visit('/gallery/?p=trip_video.mp4');
    cy.get('div[title="info key: i"]').click();
    cy.get('#swipeable-container').click();
    cy.get('.controls-video input.video-progress').invoke('val', 73.51484960779216)
      .trigger('change');
    cy.get('#swipeable-container').click();
    cy.wait(1000);
    cy.window().screenshot('video', {capture: 'viewport'});
  });
  it.skip('settings', () => {
    cy.wait('@getContent');
    cy.get('ng-icon[name="ionMenuOutline"]').click({scrollBehavior: false});
    cy.get('ng-icon[name="ionSettingsOutline"]').click({scrollBehavior: false});
    cy.wait(1000);
    cy.get('#config-priority').click({force: true});
    cy.get('button').contains('Advanced').click({force: true});
    cy.wait(2000);
    cy.get('.admin-menu button').contains('Photo').click({scrollBehavior: false});
    cy.wait(1000);
    cy.window().screenshot('settings', {capture: 'viewport'});
  });

  it.skip('albums', () => {
    cy.intercept({
      method: 'Get',
      url: '/pgapi/albums',
    }).as('getAlbums');
    cy.visit('/albums');
    cy.wait('@getAlbums');
    cy.wait(1000);
    cy.window().screenshot('albums', {clip: {x: 0, y: 0, width: 1600 * 2 / 3, height: 900 * 2 / 3}});
  });

  it.skip('faces', () => {
    cy.intercept({
      method: 'Get',
      url: '/pgapi/person',
    }).as('getFaces');
    cy.visit('/faces');
    cy.wait('@getFaces');
    cy.wait(1000);
    cy.window().screenshot('faces', {clip: {x: 0, y: 0, width: 1600 * 2 / 3, height: 900 * 2 / 3}});
  });
  it.skip('random link', () => {
    cy.wait('@getContent');
    cy.get('ng-icon[name="ionMenuOutline"]').click({scrollBehavior: false});
    cy.get('ng-icon[name="ionHammerOutline"]').click({scrollBehavior: false});
    cy.get('ng-icon[name="ionShuffleOutline"]').click({scrollBehavior: false});
    cy.get('#randomLink').clear({force: true}).type('https://<your domain>/pgapi/gallery/random/{{}"type":1,"list":[{{}"type":104,"text":"Landscape","matchType":1},{{}"type":100,"text":"vuk"}]}', {
      force: true,
      scrollBehavior: false
    });
    cy.get('.modal-dialog .search-text').type('keyword:"Landscape" and vuk', {scrollBehavior: false});
    cy.wait(1000);
    cy.window().screenshot('random_link', {capture: 'viewport'});
  });

  it.skip('blog', () => {
    cy.wait('@getContent');
    cy.wait(1000);
    cy.get('app-gallery-blog .btn-blog-details').click({multiple: true, scrollBehavior: false, force: true});
    cy.window().screenshot('blog', {capture: 'viewport'});
  });
});


