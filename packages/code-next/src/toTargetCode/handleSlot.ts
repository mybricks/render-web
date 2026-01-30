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

  switch (cleanStyle.layout) {
    case "smart":
      cleanStyle.flexDirection = "column";
      break;
    case "flex-column":
      cleanStyle.flexDirection = "column";
      break;
    case "flex-row":
      cleanStyle.flexDirection = "row";
      break;
    default:
      cleanStyle.flexDirection = "row";
      break;
  }

  cleanStyle.display = "flex";

  if ("rowGap" in style || "columnGap" in style) {
    const row = style.rowGap ?? 0;
    const column = style.columnGap ?? 0;
    if (row || column) {
      // CSS gap 简写：1 值行列同；2 值 行 列
      cleanStyle.gap = row === column ? `${row}px` : `${row}px ${column}px`;
    }
    Reflect.deleteProperty(cleanStyle, "rowGap");
    Reflect.deleteProperty(cleanStyle, "columnGap");
  }

  if (cleanStyle.flexWrap === "nowrap") {
    Reflect.deleteProperty(cleanStyle, "flexWrap");
  }

  Reflect.deleteProperty(cleanStyle, "layout");
  Reflect.deleteProperty(cleanStyle, "position");

  return cleanStyle;
};
