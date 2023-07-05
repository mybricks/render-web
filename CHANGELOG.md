# Changelog

在此处将完整记录所有正式版本的变更日志，无论是微调一行样式还是进行重大改动

## 1.1.55 (2023-07-05)

### Features

* 插槽className与设计引擎保持一致，用于样式隔离，在插槽dom上添加一个名为slot的class，不包含样式信息，仅用于css选择器

## 1.1.54 (2023-07-05)

### Features

* 多场景，外部可通过 `disableAutoRun` 字段控制是否自主控制 `autorun组件` 的执行

## 1.1.53 (2023-07-04)

### Bug Fixes

* 补充缺失的多场景输入的“当前输入”数据

## 1.1.52 (2023-06-30)

### Bug Fixes

* 历史遗留问题，对应scope插槽的判定，变更为slot配置中type属性必须为scope

## 1.1.51 (2023-06-20)

### Bug Fixes

* 例如“页面”级输入打开对话框，此时输入不带有作用域信息（scope），而在对话框作用域内去获取当前输入数据时，无法通过作用域信息（scope）拿到正确的输入信息。目前解决方式为尝试去查找无作用域信息的输入数据。

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
