import type { Style } from "../../toCode/types";
import { indentation } from "./string";

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

// [TODO] 样式的表现上hm与web有很多不同的地方，智能布局算法需要重构优化
export const convertHMFlexStyle = (style: Style) => {
  if (style.height === "fit-content") {
    // hm使用auto才能实现适应内容
    style.height = "auto";
  }
  if (style.width === "fit-content") {
    style.width = "auto";
  }
  if (style.justifyContent === "space-between") {
    // 两端对齐，宽度设置100%
    style.width = "100%";
  }

  if (style.width === "100%") {
    // 如果是填充状态，将padding转margin，hm和web行为不一致
    if ("marginTop" in style && (style.marginTop as number) > 0) {
      style.paddingTop = style.marginTop;
      Reflect.deleteProperty(style, "marginTop");
    }
    if ("marginRight" in style && (style.marginRight as number) > 0) {
      style.paddingRight = style.marginRight;
      Reflect.deleteProperty(style, "marginRight");
    }
    if ("marginBottom" in style && (style.marginBottom as number) > 0) {
      style.paddingBottom = style.marginBottom;
      Reflect.deleteProperty(style, "marginBottom");
    }
    if ("marginLeft" in style && (style.marginLeft as number) > 0) {
      style.paddingLeft = style.marginLeft;
      Reflect.deleteProperty(style, "marginLeft");
    }
  }

  return convertHMStyle(
    Object.assign(
      {
        layout: "flex-row",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        // width: "auto",
        // height: "auto",
      },
      style,
    ),
  );
};

/** hm样式转换 */
export const convertHMStyle = (style: Style) => {
  const hmStyle: Record<string, string | number> = {};

  Object.entries(style).forEach(([key, value]) => {
    switch (key) {
      case "layout":
        hmStyle.direction =
          HM_STYLE_MAP.layout[value] || HM_STYLE_MAP.layout.default;
        break;
      case "justifyContent":
        hmStyle.justifyContent =
          HM_STYLE_MAP.justifyContent[value] ||
          HM_STYLE_MAP.justifyContent.default;
        break;
      case "alignItems":
        hmStyle.alignItems =
          HM_STYLE_MAP.alignItems[value] || HM_STYLE_MAP.alignItems.default;
        break;
      case "flexDirection":
        hmStyle.direction =
          HM_STYLE_MAP.flexDirection[value] ||
          HM_STYLE_MAP.flexDirection.default;
        break;
      case "display":
        // 这个属性hm内不需要关心，使用Flex组件
        break;
      default:
        hmStyle[key] = value;
        break;
    }
  });

  return hmStyle;
};

const IGNORE_COMPONENT_STYLE_KEYS = new Set(["_new", "themesId", "visibility"]);

const IGNORE_COMPONENT_ROOT_STYLE_KEYS = new Set([
  "rightAsFixed",
  "bottomAsFixed",
  "topAsFixed",
  "leftAsFixed",
]);

const INCLUDE_ROOT_STYLE_TYPES = new Set(["string", "number"]);

const REPLACE_PX_KEYS = new Set([
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);

/** 组件样式转换(风格化、root根节点) */
export const convertComponentStyle = (style: Style) => {
  const resultStyle: Record<string, Record<string, string | number>> = {};
  const rootStyle: Record<string, string | number> = {};
  Object.entries(style).forEach(([key, value]) => {
    if (IGNORE_COMPONENT_STYLE_KEYS.has(key)) {
      return;
    } else if (key === "styleAry") {
      value.forEach(
        ({
          css,
          selector,
        }: {
          css: Record<string, string | number>;
          selector: string;
        }) => {
          resultStyle[selector] = Object.entries(css).reduce(
            (css, [key, value]) => {
              if (REPLACE_PX_KEYS.has(key) && typeof value === "string") {
                css[key] = value.replace("px", "");
              }

              return css;
            },
            css,
          );
        },
      );
    } else {
      if (IGNORE_COMPONENT_ROOT_STYLE_KEYS.has(key)) {
        return;
      }
      if (INCLUDE_ROOT_STYLE_TYPES.has(typeof value)) {
        rootStyle[key] = value;
      }
    }
  });
  resultStyle["root"] = rootStyle;
  if (
    ("flex" in rootStyle && !("width" in rootStyle)) ||
    rootStyle["width"] === "auto"
  ) {
    // 有flex，设置宽度100%
    rootStyle["width"] = "100%";
  }

  if (rootStyle.width === "100%") {
    if ("marginLeft" in rootStyle) {
      if ((rootStyle.marginLeft as number) > 0) {
        rootStyle.paddingLeft = rootStyle.marginLeft;
        Reflect.deleteProperty(rootStyle, "marginLeft");
      }
    }
    if ("marginRight" in rootStyle) {
      if ((rootStyle.marginRight as number) > 0) {
        rootStyle.paddingRight = rootStyle.marginRight;
        Reflect.deleteProperty(rootStyle, "marginRight");
      }
    }
  }

  if (rootStyle.height === "100%") {
    if ("marginTop" in rootStyle) {
      if ((rootStyle.marginTop as number) > 0) {
        rootStyle.paddingTop = rootStyle.marginTop;
        Reflect.deleteProperty(rootStyle, "marginTop");
      }
    }
    if ("marginBottom" in rootStyle) {
      if ((rootStyle.marginBottom as number) > 0) {
        rootStyle.paddingBottom = rootStyle.marginBottom;
        Reflect.deleteProperty(rootStyle, "marginBottom");
      }
    }
  }

  // if (rootStyle.position) {
  //   if (rootStyle.position === "fixed") {
  //     rootStyle.zIndex = 1000;
  //   } else if (rootStyle.position === "absolute") {
  //     rootStyle.zIndex = 1;
  //   }
  // }

  // if ("flex" in rootStyle) {
  //   // 如果是填充状态，将padding转margin，hm和web行为不一致
  //   if ("paddingTop" in rootStyle) {
  //     rootStyle.marginTop = rootStyle.paddingTop;
  //     Reflect.deleteProperty(rootStyle, "paddingTop");
  //   }
  //   if ("paddingRight" in rootStyle) {
  //     rootStyle.marginRight = rootStyle.paddingRight;
  //     Reflect.deleteProperty(rootStyle, "paddingRight");
  //   }
  //   if ("paddingBottom" in rootStyle) {
  //     rootStyle.marginBottom = rootStyle.paddingBottom;
  //     Reflect.deleteProperty(rootStyle, "paddingBottom");
  //   }
  //   if ("paddingLeft" in rootStyle) {
  //     rootStyle.marginLeft = rootStyle.paddingLeft;
  //     Reflect.deleteProperty(rootStyle, "paddingLeft");
  //   }
  // }

  return resultStyle;
};

/** 转hm Flex代码 */
export const convertHarmonyFlexComponent = (
  style: Style,
  config: {
    scope: boolean;
    child: string;
    useExtraFlex?: boolean;
    initialIndent: number;
    indentSize: number;
  },
) => {
  const hmStyle = convertHMFlexStyle(style);
  const { direction, justifyContent, alignItems } = hmStyle;
  const { scope, child, useExtraFlex, initialIndent, indentSize } = config;

  const convertHarmonyStyleConfig = {
    initialIndent,
    indentSize,
  };

  return (
    `${indentation(initialIndent)}Flex({\n` +
    `${indentation(initialIndent + indentSize)}direction: ${direction},\n` +
    `${indentation(initialIndent + indentSize)}justifyContent: ${justifyContent},\n` +
    `${indentation(initialIndent + indentSize)}alignItems: ${alignItems},\n` +
    (useExtraFlex
      ? `${getExtraFlexCode({
          initialIndent: initialIndent + indentSize,
          indentSize,
          scope,
        })}\n`
      : convertHarmonyFlexGap(hmStyle, convertHarmonyStyleConfig)) +
    `${indentation(initialIndent)}}) {\n` +
    `${child}\n` +
    `${indentation(initialIndent)}}` +
    convertHarmonyFlex(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyWidth(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyHeight(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyMargin(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyPadding(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyBasicStyle(hmStyle, {
      key: "zIndex",
      useQuotes: false,
      ...convertHarmonyStyleConfig,
    }) +
    convertHarmonyBasicStyle(hmStyle, {
      key: "backgroundColor",
      useQuotes: true,
      ...convertHarmonyStyleConfig,
    }) +
    convertHarmonyBackgroundImage(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyBorderRadius(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyBorder(hmStyle, convertHarmonyStyleConfig) +
    convertHarmonyBoxShadow(hmStyle, convertHarmonyStyleConfig)
  );
};

const convertHarmonyFlexGap = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const { indentSize, initialIndent } = config;

  // 目前智能布局实现，只有主轴方向的gap，所以取其一使用space.main即可
  const gap = style.columnGap || style.rowGap;

  if (gap) {
    const indent = indentation(initialIndent);
    const indent2 = indentation(initialIndent + indentSize);
    return (
      `\n${indent}space: {` +
      `\n${indent2}main: LengthMetrics.vp(${gap}),` +
      `\n${indent}}`
    );
  }

  return "";
};

interface GetExtraFlexCodeConfig extends ConvertHarmonyStyleConfig {
  scope: boolean;
}
const getExtraFlexCode = (config: GetExtraFlexCodeConfig) => {
  const { indentSize, initialIndent, scope } = config;
  const indent = indentation(initialIndent);
  const indent2 = indentation(initialIndent + indentSize);
  const params = (scope ? "this." : "") + "params";

  return (
    `${indent}wrap: ${params}.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,` +
    `\n${indent}space: {` +
    `\n${indent2}main: LengthMetrics.vp(${params}.style?.rowGap || 0),` +
    `\n${indent2}cross: LengthMetrics.vp(${params}.style?.columnGap || 0),` +
    `\n${indent}}`
  );
};

type HmStyle = Record<string, number | string>;

/** 转hm margin代码 */
const convertHarmonyMargin = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const { marginTop, marginRight, marginBottom, marginLeft } = style;
  const codes = [];

  if (marginTop) {
    codes.push(`top: ${marginTop},`);
  }
  if (marginRight) {
    codes.push(`right: ${marginRight},`);
  }
  if (marginBottom) {
    codes.push(`bottom: ${marginBottom},`);
  }
  if (marginLeft) {
    codes.push(`left: ${marginLeft},`);
  }

  if (codes.length) {
    return genObjectStyleCode("margin", codes, config);
  }

  return "";
};

/** 转hm padding代码 */
const convertHarmonyPadding = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const { padding, paddingTop, paddingRight, paddingBottom, paddingLeft } =
    style;

  if (padding) {
    const values = String(padding).split(" ");
    const length = values.length;
    const [first, second, third, fourth] = values;
    const initialIndent = `\n${indentation(config.initialIndent)}`;

    if (length === 1) {
      return `${initialIndent}.padding(${removePx(values[0])})`;
    } else if (length === 2) {
      const firstValue = removePx(first);
      const secondValue = removePx(second);
      return genObjectStyleCode(
        "padding",
        [
          `top: ${firstValue},`,
          `right: ${secondValue},`,
          `bottom: ${firstValue},`,
          `left: ${secondValue},`,
        ],
        config,
      );
    } else if (length === 3) {
      const secondValue = removePx(second);
      return genObjectStyleCode(
        "padding",
        [
          `top: ${removePx(first)},`,
          `right: ${secondValue},`,
          `bottom: ${removePx(third)},`,
          `left: ${secondValue},`,
        ],
        config,
      );
    } else {
      const firstValue = removePx(first);
      return genObjectStyleCode(
        "padding",
        [
          `top: ${firstValue},`,
          `right: ${removePx(second)},`,
          `bottom: ${firstValue},`,
          `left: ${removePx(fourth)},`,
        ],
        config,
      );
    }
  }

  const codes = [];
  if (paddingTop) {
    codes.push(`top: ${removePx(paddingTop)},`);
  }
  if (paddingRight) {
    codes.push(`right: ${removePx(paddingRight)},`);
  }
  if (paddingBottom) {
    codes.push(`bottom: ${removePx(paddingBottom)},`);
  }
  if (paddingLeft) {
    codes.push(`left: ${removePx(paddingLeft)},`);
  }

  if (codes.length) {
    return genObjectStyleCode("padding", codes, config);
  }
  return "";
};

/** 转hm width代码 */
const convertHarmonyWidth = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const indent = `\n${indentation(config.initialIndent)}`;
  if (style.widthFull) {
    if (style.layout !== "smart") {
      return `${indent}.width("100%")`;
    }
    return `${indent}.width("auto")`;
  } else if (style.widthAuto) {
    return `${indent}.width("auto")`;
  }

  return "width" in style ? `${indent}.width("${style.width}")` : "";
};

/** 转hm height代码 */
const convertHarmonyHeight = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const indent = `\n${indentation(config.initialIndent)}`;
  if (style.heightFull) {
    if (style.layout !== "smart") {
      return `${indent}.height("100%")`;
    }
    return `${indent}.height("auto")`;
  } else if (style.heightAuto) {
    return `${indent}.height("auto")`;
  }

  return "height" in style ? `${indent}.height("${style.height}")` : "";
};

interface ConvertHarmonyStyleConfig {
  initialIndent: number;
  indentSize: number;
}

/** 转hm flex代码 */
const convertHarmonyFlex = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const indent = `\n${indentation(config.initialIndent)}`;
  if ("flex" in style) {
    return `${indent}.flexGrow(${style.flex})`;
  }
  return `${indent}.flexShrink(0)`;
};

const convertHarmonyBackgroundImage = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  if (!("backgroundImage" in style)) {
    return "";
  }

  const backgroundImage = style.backgroundImage as string;

  if (backgroundImage.startsWith("url")) {
    const match = backgroundImage.match(/url\((["']?)([^)"']+)\1\)/);

    if (match) {
      return `\n${indentation(config.initialIndent)}.backgroundImage("${match[2]}")`;
    }

    return "";
  } else if (backgroundImage.startsWith("linear-gradient")) {
    return `\n${indentation(config.initialIndent)}.linearGradient(${JSON.stringify(parseLinearGradient(backgroundImage))})`;
  }

  return "";
};

const convertHarmonyBorderRadius = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  if (!("borderRadius" in style)) {
    return "";
  }

  const values = String(style.borderRadius).split(" ");
  const length = values.length;
  const [first, second, third, fourth] = values;
  const initialIndent = `\n${indentation(config.initialIndent)}`;

  if (length === 1) {
    return `${initialIndent}.borderRadius(${removePx(values[0])})`;
  } else if (length === 2) {
    const valueIndent = `\n${indentation(config.initialIndent + config.indentSize)}`;
    const firstValue = removePx(first);
    const secondValue = removePx(second);
    return (
      `${initialIndent}.borderRadius({` +
      [
        `topLeft: ${firstValue},`,
        `topRight: ${secondValue},`,
        `bottomRight: ${firstValue},`,
        `bottomLeft: ${secondValue},`,
      ].reduce((pre, cur) => {
        return pre + `${valueIndent}${cur}`;
      }, "") +
      `${initialIndent}})`
    );
  } else if (length === 3) {
    const valueIndent = `\n${indentation(config.initialIndent + config.indentSize)}`;
    const secondValue = removePx(second);
    return (
      `${initialIndent}.borderRadius({` +
      [
        `topLeft: ${removePx(first)},`,
        `topRight: ${secondValue},`,
        `bottomRight: ${removePx(third)},`,
        `bottomLeft: ${secondValue},`,
      ].reduce((pre, cur) => {
        return pre + `${valueIndent}${cur}`;
      }, "") +
      `${initialIndent}})`
    );
  } else {
    const valueIndent = `\n${indentation(config.initialIndent + config.indentSize)}`;
    return (
      `${initialIndent}.borderRadius({` +
      [
        `topLeft: ${removePx(first)},`,
        `topRight: ${removePx(second)},`,
        `bottomRight: ${removePx(third)},`,
        `bottomLeft: ${removePx(fourth)},`,
      ].reduce((pre, cur) => {
        return pre + `${valueIndent}${cur}`;
      }, "") +
      `${initialIndent}})`
    );
  }
};

const BORDER_STYLE_HM_MAP: Record<string, string> = {
  solid: "BorderStyle.Solid",
  dashed: "BorderStyle.Dashed",
  dotted: "BorderStyle.Dotted",
};

const convertHarmonyBorder = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  const { border, borderTop, borderRight, borderBottom, borderLeft } = style;

  if (border) {
    const { width, style, color } = parseBorder(border as string);
    return `\n${indentation(config.initialIndent)}.border({ width: ${width}, style: ${style}, color: "${color}", })`;
  }

  const borderWidth: string[] = [];
  const borderStyle: string[] = [];
  const borderColor: string[] = [];

  [
    [borderTop, "top"],
    [borderRight, "right"],
    [borderBottom, "bottom"],
    [borderLeft, "left"],
  ].forEach(([border, key]) => {
    if (border) {
      const { width, style, color } = parseBorder(border as string);
      borderWidth.push(`${key}: ${width},`);
      borderStyle.push(`${key}: ${style},`);
      borderColor.push(`${key}: "${color}",`);
    }
  });

  return (
    genObjectStyleCode("borderWidth", borderWidth, config) +
    genObjectStyleCode("borderStyle", borderStyle, config) +
    genObjectStyleCode("borderColor", borderColor, config)
  );
};

/** 通用对象属性格式化代码生成 */
const genObjectStyleCode = (
  key: string,
  items: string[],
  config: ConvertHarmonyStyleConfig,
) => {
  if (!items.length) {
    return "";
  }

  const initialIndent = `\n${indentation(config.initialIndent)}`;
  if (items.length > 3) {
    // 换行
    const valueIndent = `\n${indentation(config.initialIndent + config.indentSize)}`;
    return (
      `${initialIndent}.${key}({` +
      items.reduce((pre, cur) => {
        return pre + `${valueIndent}${cur}`;
      }, "") +
      `${initialIndent}})`
    );
  } else {
    return `${initialIndent}.${key}({${items.reduce((pre, cur) => {
      return pre + ` ${cur}`;
    }, "")} })`;
  }
};

const convertHarmonyBoxShadow = (
  style: HmStyle,
  config: ConvertHarmonyStyleConfig,
) => {
  if (!("boxShadow" in style)) {
    return "";
  }

  const boxShadow = parseBoxShadow(style.boxShadow as string);

  return genObjectStyleCode(
    "shadow",
    [
      `offsetX: ${removePx(boxShadow.offsetX)},`,
      `offsetY: ${removePx(boxShadow.offsetY)},`,
      `color: ${boxShadow.color},`,
      `radius: ${removePx(boxShadow.blurRadius)},`,
      `fill: ${boxShadow.inset},`,
    ],
    config,
  );
};

interface ConvertHarmonyBasicStyleConfig extends ConvertHarmonyStyleConfig {
  key: string;
  useQuotes: boolean;
}

/** 转hm 基础style（无特别操作来处理样式） */
export const convertHarmonyBasicStyle = (
  style: HmStyle,
  config: ConvertHarmonyBasicStyleConfig,
) => {
  const { key, useQuotes } = config;

  if (!(key in style)) {
    return "";
  }

  const quote = useQuotes ? '"' : "";

  return `\n${indentation(config.initialIndent)}.${key}(${quote}${style[key]}${quote})`;
};

interface ParseLinearGradientResult {
  angle: number;
  colors: Array<[string, number]>;
}

/** 解析渐变色 */
const parseLinearGradient = (
  gradientStr: string,
): ParseLinearGradientResult => {
  try {
    // 移除 'linear-gradient(' 和最后的 ')'
    const content: string = gradientStr.replace(/^linear-gradient\(|\)$/g, "");

    // 使用正则表达式匹配角度
    const angleMatch = content.match(/(\d+)deg/);
    const angle: number = angleMatch ? parseInt(angleMatch[1]) : 0;

    // 使用正则表达式匹配颜色和百分比
    // 支持 rgba, rgb, hex 和颜色名称
    const colorRegex =
      /(?:rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|#[0-9a-fA-F]{3,6}|\w+)\s*(\d+)%/g;
    const colorMatches = content.match(colorRegex);

    const colors: Array<[string, number]> = [];

    if (colorMatches) {
      colorMatches.forEach((match) => {
        // 分离颜色和百分比
        const lastSpaceIndex = match.lastIndexOf(" ");
        let color, percentStr;

        if (lastSpaceIndex === -1) {
          // 如果没有空格（比如 "0%" 单独出现），这可能是个错误情况
          return;
        } else {
          color = match.substring(0, lastSpaceIndex).trim();
          percentStr = match.substring(lastSpaceIndex).trim();
        }

        const percent = parseInt(percentStr.replace("%", ""));
        colors.push([color, percent / 100]);
      });
    }

    return {
      angle: angle,
      colors: colors,
    };
  } catch (error) {
    console.error("[parseLinearGradient]", error);
    return {
      angle: 0,
      colors: [],
    };
  }
};

/** 解析border */
const parseBorder = (border: string) => {
  const match = (border as string).match(
    /^(\d*\.?\d+\w+)\s+(solid|dashed|dotted)\s+(.+)$/,
  )!;

  const [, width, style, color] = match;

  return {
    width: removePx(width),
    style: BORDER_STYLE_HM_MAP[style],
    color,
  };
};

/** 解析boxShadow */
const parseBoxShadow = (boxShadow: string) => {
  const result = {
    inset: false,
    offsetX: "0",
    offsetY: "0",
    blurRadius: "0",
    spreadRadius: "0",
    color: "",
  };

  boxShadow = boxShadow.trim();

  if (boxShadow.startsWith("inset")) {
    result.inset = true;
    boxShadow = boxShadow.replace(/^inset\s+/, "");
  }

  const regex =
    /^([-\d.]+px)\s+([-\d.]+px)\s+([-\d.]+px)\s+([-\d.]+px)\s+(.+)$/;
  const match = boxShadow.match(regex);

  if (match) {
    result.offsetX = match[1];
    result.offsetY = match[2];
    result.blurRadius = match[3];
    result.spreadRadius = match[4];
    result.color = match[5].trim();
  } else {
    console.error("[parseBoxShadow - 数据格式不正确]", boxShadow);
  }

  return result;
};

/** 去除px */
const removePx = (str: string | number) => {
  if (typeof str === "number") {
    return str;
  }
  if (/px$/.test(str)) {
    return parseFloat(str) || 0;
  }
  return `"${str}"`;
};

export const getPaddingCode = (
  componentStyle: Record<string, Record<string, string | number>>,
  config: ConvertHarmonyStyleConfig,
) => {
  const { root } = componentStyle;
  const codes: string[] = [];

  if (root.paddingTop) {
    codes.push(`top: ${root.paddingTop},`);
    delete root.paddingTop;
  }
  if (root.paddingRight) {
    codes.push(`right: ${root.paddingRight},`);
    delete root.paddingRight;
  }
  if (root.paddingBottom) {
    codes.push(`bottom: ${root.paddingBottom},`);
    delete root.paddingBottom;
  }
  if (root.paddingLeft) {
    codes.push(`left: ${root.paddingLeft},`);
    delete root.paddingLeft;
  }

  return genObjectStyleCode("padding", codes, config);
};

export * from "./pinyin";
export * from "./string";
export * from "./code";
