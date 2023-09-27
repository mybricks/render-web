import Vue from "vue";
import App from "./App.vue";
import toJSON from "./toJSON.json";

// export function render({json, opts}, selector) {
//   new Vue({
//     render: (h) => h(App, { props: { json, opts }}, []),
//   }).$mount(selector);
// }

// render({json: toJSON, opts: { env: { runtime: {}, pxToVw: true } }}, "#app");



// import toJSON from "./toJSON.json";

const render = window['mybricks-render-vue2'].render;

render({json: toJSON, opts: { env: { runtime: {}, pxToVw: true } }}, "#app");
