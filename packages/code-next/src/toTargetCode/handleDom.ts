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
    jsx: `<${divTag} style={${JSON.stringify(cleanStyle(props.style))}}>${jsxCode}</${divTag}>`,
    css: cssCode,
  };
};

export default handleDom;

const cleanStyle = (style: any) => {
  const result = {
    ...style,
  };

  if (result.flexDirection === "row") {
    Reflect.deleteProperty(result, "flexDirection");
  }

  const top = (result.marginTop ?? 0) as number;
  const right = (result.marginRight ?? 0) as number;
  const bottom = (result.marginBottom ?? 0) as number;
  const left = (result.marginLeft ?? 0) as number;

  const nonZeroMargins = [
    top && "marginTop",
    right && "marginRight",
    bottom && "marginBottom",
    left && "marginLeft",
  ].filter(Boolean) as string[];

  if (nonZeroMargins.length >= 1) {
    Reflect.deleteProperty(result, "marginTop");
    Reflect.deleteProperty(result, "marginRight");
    Reflect.deleteProperty(result, "marginBottom");
    Reflect.deleteProperty(result, "marginLeft");

    if (nonZeroMargins.length === 1) {
      const key = nonZeroMargins[0];
      const val =
        key === "marginTop"
          ? top
          : key === "marginRight"
            ? right
            : key === "marginBottom"
              ? bottom
              : left;
      (result as any)[key] = typeof val === "number" ? `${val}px` : val;
    } else {
      let marginValue: string;
      if (top === right && right === bottom && bottom === left) {
        marginValue = `${top}px`;
      } else if (top === bottom && right === left) {
        marginValue = `${top}px ${right}px`;
      } else if (right === left) {
        marginValue = `${top}px ${right}px ${bottom}px`;
      } else {
        marginValue = `${top}px ${right}px ${bottom}px ${left}px`;
      }
      result.margin = marginValue;
    }
  }

  return result;
};
