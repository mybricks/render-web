import setUp from "../utils"
import json from './json.json'

describe('传递数据给对胡框内的数据表格', () => {
  beforeEach(() => {
    setUp(json)
  })

  it('点击按钮后，多插槽数据会变化', () => {
      cy.contains('按钮').click()
      cy.contains('对话框')
      cy.contains('列1')
      cy.contains('hjsFQe')
      cy.contains('8asTeE')
  })
})