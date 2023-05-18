import setUp from "../utils"
import json from './json.json'

describe('折叠面板+点击添加功能', () => {
  beforeEach(() => {
    setUp(json)
  })
  it('能正确添加折叠面板', () => {

      // 每次点击添加，都应该增加一项
      cy.contains('折叠面板1').click()
      cy.contains('第1项').should('be.visible')
      cy.contains('第2项').should('be.visible')
      cy.contains('第3项').should('not.exist')
      cy.contains('添加一项').click()
      cy.contains('第3项')
      cy.contains('第4项').should('not.exist')
      cy.contains('添加一项').click()
      cy.contains('第4项')
      
  })
})