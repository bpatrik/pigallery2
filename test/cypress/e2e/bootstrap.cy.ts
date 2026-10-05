describe('Bootstrap controls with zone-based change detection', () => {
  it('opens dropdowns, popovers, date/time pickers and a modal', () => {
    cy.visit('/');
    cy.get('#username').type('admin');
    cy.get('#password').type('admin');
    cy.get('button').contains('Login').click();
    cy.location('pathname').should('include', '/gallery');
    cy.visit('/admin');

    cy.get('#config-priority').click();
    cy.get('.dropdown-menu:visible').should('be.visible');
    cy.get('.dropdown-menu:visible button').last().click();

    cy.get('.version').trigger('mouseenter');
    cy.get('popover-container').should('be.visible');
    cy.get('.version').trigger('mouseleave');
    cy.get('popover-container').should('not.exist');

    cy.get('app-settings-workflow .card-header .d-flex > div:first-child').first().click();
    cy.get('#repeatType0').select('scheduled');
    cy.get('app-timestamp-datepicker input').first().click();
    cy.get('bs-datepicker-container').should('be.visible');
    cy.get('bs-datepicker-container td span').contains(/^15$/).click();
    cy.get('bs-datepicker-container').should('not.exist');
    cy.get('app-timestamp-datepicker input').first().invoke('val').should('match', /\.15,/);

    cy.get('#repeatType0').select('periodic');
    cy.get('app-timestamp-timepicker input').first().clear().type('10').blur();
    cy.get('app-timestamp-timepicker input').first().should('have.value', '10');

    // Exercise the modal without saving settings or starting a job.
    cy.get('app-settings-workflow > button').click();
    cy.get('#jobModal').should('be.visible');
    cy.get('#jobModal .btn-close').click();
    cy.get('#jobModal').should('not.be.visible');
  });
});
