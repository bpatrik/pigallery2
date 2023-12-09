describe('Search', () => {
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
  it('Search builder should propagate to search bar', () => {
    cy.get('.mb-0 > :nth-child(1) > .nav-link').contains('Gallery');

    cy.get('app-gallery-search .search-text').type('a and b', {force: true});
    cy.get('app-gallery-search ng-icon[name="ionChevronDownOutline"]').click();
    cy.get('app-gallery-search-query-builder app-gallery-search-field-base input.search-text').should('have.value', 'a and b');
    cy.get('app-gallery-search-query-entry .btn-danger').last().click();
    cy.get('app-gallery-search-query-builder app-gallery-search-field-base input.search-text').should('have.value', 'a');
    cy.get('modal-container .btn-close').click();
    cy.get('app-gallery-search .search-text').should('have.value', 'a');

  });
});
