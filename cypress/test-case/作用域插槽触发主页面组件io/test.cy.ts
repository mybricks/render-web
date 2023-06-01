import setUp from "../utils"
import json from './json.json'

describe('作用域插槽触发主页面组件io', () => {
  beforeEach(() => {
    setUp(json)
  })
  it('点击主页按钮和插槽内按钮可以修改主页文本', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      cy.contains('待修改文本').as('text')
      cy.contains('主页面按钮').click()
      cy.contains('被主页面按钮修改')
      cy.contains('作用域插槽按钮').click()
      cy.contains('被作用域插槽按钮修改')
      cy.contains('主页面按钮').click()
      cy.contains('被主页面按钮修改')
  })
})