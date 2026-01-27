/* eslint-disable @typescript-eslint/no-explicit-any */
import { TAG_TRANSLATE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleCom from "./handleCom";

type Dom = Extract<UI["children"][0], { type: "dom" }>;

const handleDom = (dom: Dom, config: BaseConfig) => {
  const { children, props } = dom;

  let jsxCode = "";
  let cssCode = "";

  children.forEach((child) => {
    if (child.type === "com") {
      const { jsx, css } = handleCom(child, config);
      jsxCode += jsx;
      cssCode += css;
    } else if (child.type === "dom") {
      const { jsx, css } = handleDom(child, config);
      jsxCode += jsx;
      cssCode += css;
    }
  });

  const divTag = TAG_TRANSLATE[config.target].div;

  return {
    jsx: `<${divTag} style={${JSON.stringify(props.style)}}>${jsxCode}</${divTag}>`,
    css: cssCode,
  };
};

export default handleDom;
