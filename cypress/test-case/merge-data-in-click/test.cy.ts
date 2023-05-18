import setUp from "../utils"
import json from './json.json'

describe('点击后触发数据合并', () => {
  beforeEach(() => {
    setUp(json)
  })

  it('点击后触发数据合并', () => {
      cy.contains('没有合并数据')
      cy.contains('按钮').click()
      cy.contains('收到合并数据')
  })
})