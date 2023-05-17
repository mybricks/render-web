import renderTestPage from "../utils"
import json from './json.json'

describe('快速重复赋值表格内插槽数据', () => {
  it('插槽数据需要更新', () => {
    // it函数的回调不能是异步函数，异步函数只能放在cy.then里面
      const page = renderTestPage(json)
      cy.mount(page)

      cy.contains('这个数据没有改变').should('not.exist')

      for (let i =0;i<5;i++) {
        // 快速点击翻页，表格数据需要被更新
        cy.get('.ant-pagination-next').click()
        cy.get('.ant-pagination-next').click()
        cy.get('.ant-pagination-next').click()
        cy.contains('这个数据没有改变').should('not.exist')
        cy.get('.ant-pagination-prev').click()
        cy.get('.ant-pagination-prev').click()
        cy.get('.ant-pagination-prev').click()
        cy.contains('这个数据没有改变').should('not.exist')
      }
  })
})