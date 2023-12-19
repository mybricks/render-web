/// <reference types="cypress" />
import { mount, MountReturn  } from 'cypress/react18'

declare global {
  namespace Cypress {
    interface Chainable {
      mount(
        json: any
      ): Cypress.Chainable<MountReturn>
    }
  }
}

import { render } from '../../src/index'

Cypress.Commands.add('mount', (json) => {
  return mount(render(json, {
    env: {
      i18n(text) {
        //多语言
        return text
      },
    }
  }))
})
