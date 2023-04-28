import renderTestPage from "../utils"
import json from './json.json'

describe('列表作用域插槽功能', () => {
  it('隐藏和显示按钮能正常控制列表，且列表的显示隐藏不会触发插槽事件', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      const page = renderTestPage(json)
      cy.mount(page)

      cy.contains('第一项')
      cy.contains('第二项')
      // 因为列表有2个元素，所以触发两次
      cy.contains('插槽触发次数为2')

      // 测试隐藏操作
      cy.contains('隐藏').click()
      cy.contains('第一项').should('not.be.visible')
      cy.contains('第二项').should('not.be.visible')
      
      // 测试显示操作
      cy.contains('显示').click()
      cy.contains('第一项')
      cy.contains('第二项')

      // 显示和隐藏应该不会触发插槽io
      cy.contains('插槽触发次数为2')
      
  })
})