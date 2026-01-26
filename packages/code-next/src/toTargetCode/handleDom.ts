/* eslint-disable @typescript-eslint/no-explicit-any */
import { TAG_TRANSLATE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleCom from "./handleCom";

type Dom = Extract<UI["children"][0], { type: "dom" }>;

const handleDom = (dom: Dom, config: BaseConfig) => {
  const { children, props } = dom;

  let uiCode = "";

  children.forEach((child) => {
    if (child.type === "com") {
      uiCode += handleCom(child, config);
    } else if (child.type === "dom") {
      uiCode += handleDom(child, config);
    }
  });

  const divTag = TAG_TRANSLATE[config.target].div;

  return `<${divTag} style={${JSON.stringify(props.style)}}>${uiCode}</${divTag}>`;
};

export default handleDom;
