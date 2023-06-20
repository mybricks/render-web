# Changelog

这里将记录所有正式版本的变更记录，哪怕只是修改了一行样式。

## 1.1.48 (2023-06-20)

### Features

* `env`支持配置`shadowRoot`字段，支持云组件在不同搭建引擎中能够正确渲染`style(生成style标签)`样式
  ``` javascript
    const root = env?.shadowRoot || document.getElementById('_mybricks-geo-webview_')?.shadowRoot
  ```
