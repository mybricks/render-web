import setUp from "../utils"
import json from './json.json'

describe('表格组件嵌套', () => {
  beforeEach(() => {
    setUp(json)
  })

  it('数据可以正确传递到内部表格，且二次赋值也可正确传递数据', () => {

      cy.contains('1-1')
      cy.contains('1-2')
      cy.contains('2-1')
      cy.contains('2-2')
      
      cy.contains('二次赋值').click()
      cy.contains('_1-1')
      cy.contains('_1-2')
      cy.contains('_2-1')
      cy.contains('_2-2')
  })
})