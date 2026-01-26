/* eslint-disable @typescript-eslint/no-explicit-any */
import { TAG_TRANSLATE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleCom from "./handleCom";
import handleDom from "./handleDom";

const handleSlot = (ui: UI, config: BaseConfig) => {
  const { children, props } = ui;

  let uiCode = "";

  children.forEach((child) => {
    if (child.type === "com") {
      uiCode += handleCom(child, config);
    } else if (child.type === "dom") {
      uiCode += handleDom(child, config);
    }
  });

  const divTag = TAG_TRANSLATE[config.target].div;

  return `<${divTag} style={${JSON.stringify(cleanStyle(props.style))}}>${uiCode}</${divTag}>`;
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
