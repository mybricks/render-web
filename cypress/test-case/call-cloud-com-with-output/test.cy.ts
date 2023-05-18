import setUp from "../utils"
import json from './json.json'
// 手动加载云组件
import './cloud-com.js'

describe('调用带有输出的云组件组件', () => {
  beforeEach(() => {
    setUp(json)
  })

  it('带输出的云组件可以正确触发输出', () => {
      cy.contains('未收到消息')
      cy.contains('按钮').click()
      cy.contains('已收到消息')
      
  })
})