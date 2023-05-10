import renderTestPage from "../utils"
import json from './json.json'

describe('点击后触发数据合并', () => {
  it('点击后触发数据合并', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      const page = renderTestPage(json)
      cy.mount(page)
      cy.contains('没有合并数据')
      cy.contains('按钮').click()
      cy.contains('收到合并数据')
  })
})