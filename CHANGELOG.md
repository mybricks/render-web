# Changelog

在此处将完整记录所有正式版本的变更日志，无论是微调一行样式还是进行重大改动。

## 1.1.50 (2023-06-20)

### Bug Fixes

* 作用域中如果有自执行组件，且需要获取当前输入的数据，在当前组件渲染插槽时，先注入输入的值，再运行自执行组件，避免时许错乱而拿不到输入值

## 1.1.49 (2023-06-20)

### Bug Fixes

* 循环列表场景，自执行组件是否执行，根据当前作用域进行判断
  ``` javascript
  // 旧
  let runExed -> if (!runExed) -> runExed = true
  // 新
  let runExed = {} -> if (!runExed[scopeId]) -> runExed[scopeId] = true
  ```

## 1.1.48 (2023-06-20)

### Features

* `env`支持配置`shadowRoot`字段，支持云组件在不同搭建引擎中能够正确渲染`style(生成style标签)`样式
  ``` javascript
    const root = env?.shadowRoot || document.getElementById('_mybricks-geo-webview_')?.shadowRoot
  ```
