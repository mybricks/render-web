import setUp from "../utils"
import json from './json.json'

describe('测试表单容器内的下拉框', () => {
  beforeEach(() => {
    setUp(json)
  })
  it('表单容器下拉框动态数据源测试', () => {

      cy.get('.ant-select-selection-search > input').eq(0).click()
      cy.contains('选项1').should('be.visible')
      
      cy.contains('case1').click()
      cy.contains('选项1').should('not.be.visible')
      

      cy.get('.ant-select-selection-search > input').eq(1).click()
      cy.contains('选项2').should('not.exist')
      // 点击初始化按钮后，表单2的下拉框才会有数据
      cy.contains('初始化按钮').click()
      cy.get('.ant-select-selection-search > input').eq(1).click()
      cy.contains('选项2').should('be.visible')

      cy.contains('case2').click()
      cy.contains('选项2').should('not.be.visible')


      cy.get('.ant-select-selection-search > input').eq(2).click()
      cy.contains('选项3').should('be.visible')
      
      cy.contains('case3').click()
      cy.contains('选项3').should('not.be.visible')
  })
})