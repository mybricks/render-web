import setUp from "../utils"
import json from './json.json'

describe('卡片嵌套场景变量赋值触发变量outputs["changed"]', () => {
  beforeEach(() => {
    setUp(json)
  })
  it('能正确触发多层嵌套卡片内变量变更', () => {
      cy.contains('初始值').click()
      cy.contains('hello world')
  })
})