import type { Style } from "../../toCode/types";

/**
 * 鸿蒙样式映射
 */
const HM_STYLE_MAP: Record<string, Record<string, string>> = {
  layout: {
    smart: "FlexDirection.Column", // 智能布局，默认是纵向排版
    "flex-column": "FlexDirection.Column",
    "flex-row": "FlexDirection.Row",
    default: "FlexDirection.Row",
  },
  flexDirection: {
    column: "FlexDirection.Column",
    row: "FlexDirection.Row",
    default: "FlexDirection.Row",
  },
  justifyContent: {
    "flex-start": "FlexAlign.Start",
    center: "FlexAlign.Center",
    "flex-end": "FlexAlign.End",
    "space-around": "FlexAlign.SpaceAround",
    "space-between": "FlexAlign.SpaceBetween",
    default: "FlexAlign.Start",
  },
  alignItems: {
    "flex-start": "ItemAlign.Start",
    center: "ItemAlign.Center",
    "flex-end": "ItemAlign.End",
    default: "ItemAlign.Start",
  },
};

const getHmFlexParams = (style: Style) => {
  return {
    direction: HM_STYLE_MAP.layout[style.layout || "default"],
    justifyContent:
      HM_STYLE_MAP.justifyContent[style.justifyContent || "default"],
    alignItems: HM_STYLE_MAP.alignItems[style.alignItems || "default"],
  };
};

const getHmWidth = (style: Style) => {
  return "width" in style ? `.width("${style.width}")` : "";
};

const getHmHeight = (style: Style) => {
  return "height" in style ? `.height("${style.height}")` : "";
};

const getHmMargin = (style: Style) => {
  let code = "";
  if ("marginTop" in style) {
    code += `top: "${style.marginTop}",`;
  }
  if ("marginRight" in style) {
    code += `right: "${style.marginRight}",`;
  }
  if ("marginBottom" in style) {
    code += `bottom: "${style.marginBottom}",`;
  }
  if ("marginLeft" in style) {
    code += `left: "${style.marginLeft}",`;
  }

  if (code) {
    return `.margin({${code}})`;
  }

  return "";
};

const getHmPadding = (style: Style) => {
  let code = "";
  if ("paddingTop" in style) {
    code += `top: "${style.paddingTop}",`;
  }
  if ("paddingRight" in style) {
    code += `right: "${style.paddingRight}",`;
  }
  if ("paddingBottom" in style) {
    code += `bottom: "${style.paddingBottom}",`;
  }
  if ("paddingLeft" in style) {
    code += `left: "${style.paddingLeft}",`;
  }

  if (code) {
    return `.padding({${code}})`;
  }

  return "";
};

interface GetHmUiParams {
  style: Style;
  children: string;
  extraFlex?: string;
}
/**
 * 默认用Flex布局
 */
const getHmUi = (params: GetHmUiParams) => {
  const { style, children, extraFlex } = params;
  const hmFlexParams = getHmFlexParams(style);

  return `Flex({
    direction: ${hmFlexParams.direction},
    justifyContent: ${hmFlexParams.justifyContent},
    alignItems: ${hmFlexParams.alignItems},
    ${extraFlex}
  }) {
    ${children}
  }${getHmWidth(style)}${getHmHeight(style)}${getHmPadding(style)}${getHmMargin(style)}`;
};

export { getHmUi };
