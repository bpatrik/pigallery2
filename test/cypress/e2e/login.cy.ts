describe('Login', () => {
  it('Page opens', () => {
    cy.visit('/');
    cy.get('.card-body');
    cy.get('.col-sm-12').contains('Login');
  });
  it('Login', () => {
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
    /* ==== End Cypress Studio ==== */
    cy.get('.mb-0 > :nth-child(1) > .nav-link').contains('Gallery');

    cy.wait('@getContent').then((interception) => {
      assert.isNotNull(interception.response.body, '1st API call has data');
    });
  });

});
