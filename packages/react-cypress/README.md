# @mybricks/react18-component-cypress

基于 ```React@18``` ```Cypress``` 的MyBricks组件测试套件。

## 安装

```shell
$ npm install @mybricks/react18-component-cypress
```

## 使用

```js
// commands.ts

// 注入Cypress自定义命令
import "@mybricks/react18-component-cypress/lib/commands"
```

```js
// index.cy.tsx

// 待测试的MyBricks组件
import Component from "ComponentLibrary/src/button/runtime"
import MybricksReact18ComponentTest from "@mybricks/react18-component-cypress"

const mybricksReact18ComponentTest = new MybricksReact18ComponentTest(Component, {
  // 组件数据源
  data: {},
  // 环境信息，各应用不同
  env: {}
})

const { data, inputs, outputs } = mybricksReact18ComponentTest.render()

// 判断数据源变更
cy.wrap(data).its('content').should('equal', "内容")
// 主动触发组件输入项
const is = {
  disabled: inputs['disabled'],
}
cy.wrap(is).invoke('disabled', true)
// 判断是否成功向外输出
cy.contains("button").click()
cy.wrap(outputs).its(0).should('deep.equal', { id: "click", value: "" })
```
