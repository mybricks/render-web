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
  if (style.widthFull) {
    if (style.layout !== "smart") {
      return `.width("100%")`;
    }
    return `.width("auto")`;
  } else if (style.widthAuto) {
    return `.width("auto")`;
  }

  return "width" in style ? `.width("${style.width}")` : "";
};

const getHmHeight = (style: Style) => {
  if (style.heightFull) {
    if (style.layout !== "smart") {
      return `.height("100%")`;
    }
    return `.height("auto")`;
  } else if (style.heightAuto) {
    return `.height("auto")`;
  }

  return "height" in style ? `.height("${style.height}")` : "";
};

const getHmMargin = (style: Style) => {
  const marginMap = {
    marginTop: "top",
    marginRight: "right",
    marginBottom: "bottom",
    marginLeft: "left",
  };

  const entries = [];

  for (const [styleProp, marginKey] of Object.entries(marginMap)) {
    if (styleProp in style) {
      let value = style[styleProp as keyof Style];
      if (typeof value === "string") {
        value = value.replace("px", "");
      }
      entries.push(`${marginKey}: "${value}"`);
    }
  }

  return entries.length > 0 ? `.margin({${entries.join(",")}})` : "";
};

const getHmPadding = (style: Style) => {
  const paddingMap = {
    paddingTop: "top",
    paddingRight: "right",
    paddingBottom: "bottom",
    paddingLeft: "left",
  };

  const entries = [];

  for (const [styleProp, paddingKey] of Object.entries(paddingMap)) {
    if (styleProp in style) {
      let value = style[styleProp as keyof Style];
      if (typeof value === "string") {
        value = value.replace("px", "");
      }
      entries.push(`${paddingKey}: "${value}"`);
    }
  }

  return entries.length > 0 ? `.padding({${entries.join(",")}})` : "";
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
  const { style, children, extraFlex = "" } = params;
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
