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

interface GetHmUiParams {
  style: Style;
  children: string;
}
/**
 * 默认用Flex布局
 */
const getHmUi = (params: GetHmUiParams) => {
  const { style, children } = params;
  const hmFlexParams = getHmFlexParams(style);

  return `Flex({
    direction: ${hmFlexParams.direction},
    justifyContent: ${hmFlexParams.justifyContent},
    alignItems: ${hmFlexParams.alignItems},
  }) {
    ${children}
  }${getHmWidth(style)}${getHmHeight(style)}`;
};

export { getHmUi };
