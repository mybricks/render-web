import renderTestPage from "../utils"
import json from './json.json'

describe('测试获取插槽输入项', () => {
  it('在表格内部的插槽内可以获取当前项输入', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      const page = renderTestPage(json)
      cy.mount(page)

      cy.contains('无点击')

      cy.contains('第0个按钮').click()
      cy.contains('第0行点击')
      cy.contains('第1个按钮').click()
      cy.contains('第1行点击')
      cy.contains('第2个按钮').click()
      cy.contains('第2行点击')
      
  })
})