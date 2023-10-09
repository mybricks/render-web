import Vue from "vue";
import App from "./App.vue";

export function render({json, opts}, selector) {
  new Vue({
    render: (h) => h(App, { props: { json, opts }}, []),
  }).$mount(selector);
}
