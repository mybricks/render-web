/// <reference types="cypress" />
import React from "react"
import { mount, MountOptions } from "cypress/react18"

declare global {
  namespace Cypress {
    interface Chainable {
      mountMybricksReact18Component: typeof mount
    }
  }
}

Cypress.Commands.add('mountMybricksReact18Component', (jsx: React.ReactNode, options?: MountOptions, rerenderKey?: string) => {
  return mount(jsx, options, rerenderKey)
})
