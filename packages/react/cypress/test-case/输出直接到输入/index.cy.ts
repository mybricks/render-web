import dumpJSON from './dump.json'

describe('输出直接到输入', () => {
  it('输出直接到输入', () => {
    cy.mount(dumpJSON)
    const button = cy.contains("按 钮")
    button.click()
    cy.contains("helloworld")
  })
})
