import renderTestPage from "../utils"
import json from './json.json'

describe('多插槽数据传递', () => {
  it('点击按钮后，多插槽数据会变化', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      const page = renderTestPage(json)
      cy.mount(page)

      cy.contains('1-1')
      cy.contains('1-2')
      cy.contains('1-3')
      cy.contains('2-1')
      cy.contains('2-2')
      cy.contains('3-3')
      cy.contains('3-1')
      cy.contains('3-2')
      cy.contains('3-3')

      cy.contains('按钮0').click()
      cy.contains('_1-1')
      cy.contains('_1-2')
      cy.contains('_1-3')
      cy.contains('_2-1')
      cy.contains('_2-2')
      cy.contains('_3-3')
      cy.contains('_3-1')
      cy.contains('_3-2')
      cy.contains('_3-3')
      
  })
})