import Vue from "vue";
import App from "./App.vue";

export function render(json, opts) {
  return Vue.extend({
    render: h => h(App, { props: { json, opts} })
  })
}

window['mybricks-render-vue2'] = function render2({json, opts}, selector) {
  new Vue({
    render: (h) => h(App, { props: { json, opts }}, []),
  }).$mount(selector);
}