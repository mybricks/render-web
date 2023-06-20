# Changelog

在此处将完整记录所有正式版本的变更日志，无论是微调一行样式还是进行重大改动。

## 1.1.49 (2023-06-20)

### Bug Fixes

* 循环列表场景，autorun组件是否执行，根据当前作用域进行判断
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
