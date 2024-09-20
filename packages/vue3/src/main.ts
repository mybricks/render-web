// import './assets/main.css'

// import { h, createApp } from 'vue'
const { h, createApp } = window.Vue

import App from './App.vue'
import json from "./tojson.json";

console.log("json: ", json)

import { render } from "./index";

createApp(render(json, {
  env: {
    runtime: true
  }
})).mount('#app')

// 定义一个函数式组件
// const MyFunctionalComponent = (props) => {
//   return h('div', null, `Hello, ${props.name}!`);
// }

// const render2 = (props) => {
//   return {
//     // 渲染函数
//     render: () => {
//       // 使用 `h` 函数创建虚拟节点
//       return h(MyFunctionalComponent, props);
//     }
//   }
// }

// 创建应用实例
// createApp(render2({ name: 'World' })).mount('#app')

// createApp(render, {
//   json
// }).mount('#app')

// createApp(App).mount('#app')

// createApp(render(json, {
//   env: {
//     runtime: true
//   }
// })).mount('#app')

