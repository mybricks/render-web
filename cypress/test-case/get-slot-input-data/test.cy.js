import setUp from "../utils"
import json from './json.json'

describe('测试获取插槽输入项', () => {
  beforeEach(() => {
    setUp(json)
  })

  it('在表格内部的插槽内可以获取当前项输入', () => {

      cy.contains('无点击')

      cy.contains('第0个按钮').click()
      cy.contains('第0行点击')
      cy.contains('第1个按钮').click()
      cy.contains('第1行点击')
      cy.contains('第2个按钮').click()
      cy.contains('第2行点击')
      
  })
})