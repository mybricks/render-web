/// <reference types="cypress" />
import { mount, MountOptions, MountReturn  } from 'cypress/react18'
// @ts-ignore
// import { getJSONFromRXUIFile } from '@mybricks/file-parser'

declare global {
  namespace Cypress {
    interface Chainable {
      mount(
        json: any
        // component: React.ReactNode,
        // options?: MountOptions & { reduxStore?: EnhancedStore<RootState> }
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
  // return mount(render(getJSONFromRXUIFile(json.content), {
  //   env: {
  //     i18n(text) {
  //       //多语言
  //       return text
  //     },
  //   }
  // }))
})