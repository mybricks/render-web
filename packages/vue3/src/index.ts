// import pkg from "../package.json";
const pkg = {
  name: "@mybricks/render-web-vue3",
  version: "0.0.1"
}

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

export { default as render } from "./render";
