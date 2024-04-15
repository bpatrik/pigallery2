describe('Gallery', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('.card-body');
    cy.get('.col-sm-12').contains('Login');
    /* ==== Generated with Cypress Studio ==== */
    cy.get('#username').type('admin');
    cy.get('#password').clear();
    cy.get('#password').type('admin');
    cy.intercept({
      method: 'Get',
      url: '/pgapi/gallery/content/',
    }).as('getContent');
    cy.get('.col-sm-12 > .btn').click();
  });
  it('Gallery should open', () => {
    cy.get('.mb-0 > :nth-child(1) > .nav-link').contains('Gallery');
  });
  it('Gallery should filter', () => {
    cy.wait('@getContent');
    cy.get('app-gallery-navbar  ng-icon[name="ionFunnelOutline"]').click({scrollBehavior: false});
    cy.get('app-gallery-navbar #gallery-filter-0').select('City', {force: true});
    cy.get('app-gallery-navbar #gallery-filter-0').siblings('.filter-column').contains('Berkeley')
      .parent().find('ng-icon[name="ionFlagOutline"]').click({scrollBehavior: false, force: true});

    cy.get('app-gallery-navbar  ng-icon[name="ionFunnelOutline"]').click({scrollBehavior: false});
    //should indicate that the filters have changed
    cy.get('app-gallery-navbar .btn-secondary  ng-icon[name="ionFunnelOutline"]');

    for (let i = 0; i < 3; ++i) {
      cy.window().scrollTo(0, 9000, {ensureScrollable: false, duration: 100, easing: 'linear'}).wait(500);
    }
    // should this photo be visible
    cy.get('.photo-container > img[alt="IMG_5910.jpg"]');
    cy.get('.photo-container > img[alt="IMG_6220.jpg"]').should('not.exist');
  });


  it('Gallery should show infobar over photo', () => {
    cy.wait('@getContent');
    // contains a folder
    cy.get('app-gallery-directories.directories > app-gallery-directory > .button > .photo-container');


    for (let i = 0; i < 5; ++i) {
      cy.window().scrollTo(0, 9000, {ensureScrollable: false, duration: 100, easing: 'linear'}).wait(500);
    }

    // these photos should be visible
    cy.get('.photo-container > img[alt="IMG_6220.jpg"]');
    cy.get('.photo-container > img[alt="IMG_5910.jpg"]').trigger('mouseover', {scrollBehavior: 'center'});

    cy.get('.photo-container > .info > .photo-name').contains('IMG_5910.jpg');
    cy.get('.photo-container > .info > .photo-position').contains('Berkeley');
    cy.get('.photo-container > .info > .photo-keywords a').contains('Berkley');
    cy.get('.photo-container > .info > .photo-keywords a').contains('Alvin the Squirrel');
    cy.get('.photo-container > .info > .photo-keywords a').contains('USA');
  });
  it('Gallery should open lightbox', () => {
    cy.wait('@getContent');
    // contains a folder
    cy.get('app-gallery-directories.directories > app-gallery-directory > .button > .photo-container');


    for (let i = 0; i < 5; ++i) {
      cy.window().scrollTo(0, 9000, {ensureScrollable: false, duration: 100, easing: 'linear'}).wait(500);
    }

    cy.get('.photo-container > img[alt="IMG_5910.jpg"]').click({scrollBehavior: 'center'});
    cy.get('app-lightbox-controls > #controllers-container > .controls-title').contains('Squirrel at berkely');
    cy.get('app-lightbox-controls  .faces-container > .face > .face-name').contains('Alvin the Squirrel');

  });



  it('Gallery should auto play in lightbox', () => {
    cy.wait('@getContent');
    // contains a folder
    cy.get('app-gallery-directories.directories > app-gallery-directory > .button > .photo-container');


    for (let i = 0; i < 5; ++i) {
      cy.window().scrollTo(0, 9000, {ensureScrollable: false, duration: 100, easing: 'linear'}).wait(500);
    }

    cy.visit('/gallery/?p=IMG_5910.jpg');

    cy.get('app-gallery-lightbox-media img[alt="IMG_5910.jpg"]');
    cy.get('.controls-background ng-icon[name="ionPlayOutline"]').click({scrollBehavior: false});

    cy.wait(5000); // autoplay default delay is 5s
    cy.get('app-gallery-lightbox-media  img[alt="IMG_6220.jpg"]', {timeout: 2000});

  });

  it('Gallery should auto open lightbox for IMG_5910.jpg', () => {
    // ignore noisy tests
    cy.on('fail', (err, runnable) => {
      cy.log(err.message);
      return false;
    });
    cy.visit('/gallery/?p=IMG_5910.jpg');
    // at least one photo should be visible
    cy.get('app-gallery-grid-photo', {timeout: 10000});
    cy.get('.photo-container > img[alt="IMG_5910.jpg"]', {timeout: 10000}); //the main photo should be visible

    cy.get('app-lightbox-controls > #controllers-container > .controls-title').contains('Squirrel at berkely');
    cy.get('app-lightbox-controls  .faces-container > .face > .face-name').contains('Alvin the Squirrel');

  });
  it('Gallery should auto open lightbox for IMG_1252.jpg', () => {
    // ignore noisy tests
    cy.on('fail', (err, runnable) => {
      cy.log(err.message);
      return false;
    });
    cy.visit('/gallery/?p=IMG_1252.jpg');
    // at least one photo should be visible
    cy.get('app-gallery-grid-photo', {timeout: 10000});
    cy.get('.photo-container > img[alt="IMG_1252.jpg"]', {timeout: 10000}); //the main photo should be visible

    cy.get('app-lightbox-controls > #controllers-container > .controls-title').contains('This is a super long title with special characters -.,űáéúőpóüö');
    cy.get('app-lightbox-controls  .faces-container > .face > .face-name').should('not.exist');

  });
});

describe('Gallery - dont wait for content load', () => {
  it('Gallery should auto open lightbox for IMG_5910.jpg', () => {
    // ignore noisy tests
    cy.on('fail', (err, runnable) => {
      cy.log(err.message);
      return false;
    });

    cy.visit('/');
    cy.get('.card-body');
    cy.get('.col-sm-12').contains('Login');
    /* ==== Generated with Cypress Studio ==== */
    cy.get('#username').type('admin');
    cy.get('#password').clear();
    cy.get('#password').type('admin');
    cy.get('.col-sm-12 > .btn').click();
    // contains a folder

    cy.visit('/gallery/?p=IMG_5910.jpg');
    // at least one photo should be visible
    cy.get('app-gallery-grid-photo', {timeout: 10000});
    cy.get('.photo-container > img[alt="IMG_5910.jpg"]', {timeout: 10000}); //the main photo should be visible

    cy.get('app-lightbox-controls > #controllers-container > .controls-title').contains('Squirrel at berkely');
    cy.get('app-lightbox-controls  .faces-container > .face > .face-name').contains('Alvin the Squirrel');

  });
  it('Gallery should auto open lightbox for IMG_1252.jpg', () => {
    // ignore noisy tests
    cy.on('fail', (err, runnable) => {
      cy.log(err.message);
      return false;
    });
    cy.visit('/');
    cy.get('.card-body');
    cy.get('.col-sm-12').contains('Login');
    /* ==== Generated with Cypress Studio ==== */
    cy.get('#username').type('admin');
    cy.get('#password').clear();
    cy.get('#password').type('admin');
    cy.get('.col-sm-12 > .btn').click();
    // contains a folder

    cy.visit('/gallery/?p=IMG_1252.jpg');

    // at least one photo should be visible
    cy.get('app-gallery-grid-photo', {timeout: 10000});
    cy.get('.photo-container > img[alt="IMG_1252.jpg"]', {timeout: 10000}); //the main photo should be visible

    cy.get('app-lightbox-controls > #controllers-container > .controls-title').contains('This is a super long title with special characters -.,űáéúőpóüö');
    cy.get('app-lightbox-controls  .faces-container > .face').should('not.exist');

  });
});

