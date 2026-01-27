/* eslint-disable @typescript-eslint/no-explicit-any */
import { TAG_TRANSLATE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleCom from "./handleCom";
import handleDom from "./handleDom";

const handleSlot = (ui: UI, config: BaseConfig) => {
  const { children, props } = ui;

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
    jsx: `<${divTag} style={${JSON.stringify(cleanStyle(props.style))}}>${jsxCode}</${divTag}>`,
    css: cssCode,
  };
};

export default handleSlot;

const cleanStyle = (style: any) => {
  const cleanStyle = {
    ...style,
    width: "100%",
    height: "100%",
  };
  Reflect.deleteProperty(cleanStyle, "layout");
  return cleanStyle;
};
