import renderTestPage from "../utils"
import json from './json.json'

describe('在作用域内调用fx', () => {
  it('fx的输出项可以正确被执行', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      const page = renderTestPage(json)
      cy.mount(page)
      cy.contains('未收到消息')
      cy.contains('点击调用').click()
      cy.contains('已收到消息')
      
  })
})