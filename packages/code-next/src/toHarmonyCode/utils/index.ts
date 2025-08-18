import type { Style } from "../../toCode/types";

type ImportType = "default" | "named";
type DependencyImport = Record<
  string,
  Record<
    string,
    {
      importType: ImportType;
    }
  >
>;

/** 导入依赖收集、解析 */
export class ImportManager {
  private _imports: DependencyImport = {};

  constructor() {}

  /** 添加依赖 */
  addImport({
    packageName,
    dependencyNames,
    importType,
  }: {
    packageName: string;
    dependencyNames: string[];
    importType: ImportType;
  }) {
    if (!packageName) {
      return;
    }
    const { _imports } = this;
    if (!_imports[packageName]) {
      _imports[packageName] = {};
    }

    dependencyNames.forEach((dependencyName) => {
      _imports[packageName][dependencyName] = {
        importType,
      };
    });
  }

  /** 依赖解析为code */
  toCode() {
    return Object.entries(this._imports).reduce(
      (pre, [packageName, dependencies]) => {
        let defaultDependency = "";
        let namedDependencies = "";

        Object.entries(dependencies).forEach(
          ([dependencyName, { importType }]) => {
            if (importType === "default") {
              defaultDependency = dependencyName;
            } else {
              namedDependencies += `${dependencyName},`;
            }
          },
        );

        if (namedDependencies) {
          namedDependencies = `{${namedDependencies}}`;

          if (defaultDependency) {
            defaultDependency += ",";
          }
        }

        return (
          pre +
          `import ${defaultDependency} ${namedDependencies} from '${packageName}';`
        );
      },
      "",
    );
  }
}

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
  if ("flex" in rootStyle) {
    // 如果是填充状态，将padding转margin，hm和web行为不一致
    if ("paddingTop" in rootStyle) {
      rootStyle.marginTop = rootStyle.paddingTop;
      Reflect.deleteProperty(rootStyle, "paddingTop");
    }
    if ("paddingRight" in rootStyle) {
      rootStyle.marginRight = rootStyle.paddingRight;
      Reflect.deleteProperty(rootStyle, "paddingRight");
    }
    if ("paddingBottom" in rootStyle) {
      rootStyle.marginBottom = rootStyle.paddingBottom;
      Reflect.deleteProperty(rootStyle, "paddingBottom");
    }
    if ("paddingLeft" in rootStyle) {
      rootStyle.marginLeft = rootStyle.paddingLeft;
      Reflect.deleteProperty(rootStyle, "paddingLeft");
    }
  }

  return resultStyle;
};

/** 转hm Flex代码 */
export const convertHarmonyFlexComponent = (
  style: Style,
  config: { child: string; extraFlex?: string },
) => {
  const hmStyle = convertHMFlexStyle(style);
  const { direction, justifyContent, alignItems } = hmStyle;
  const { child, extraFlex = "" } = config;

  const flex =
    `Flex({
    direction: ${direction},
    justifyContent: ${justifyContent},
    alignItems: ${alignItems},
    ${extraFlex}
  }) {
    ${child}
  }` +
    convertHarmonyFlex(hmStyle) +
    convertHarmonyWidth(hmStyle) +
    convertHarmonyHeight(hmStyle) +
    convertHarmonyMargin(hmStyle) +
    convertHarmonyPadding(hmStyle) +
    convertHarmonyBasicStyle(hmStyle, {
      key: "zIndex",
      useQuotes: false,
    }) +
    convertHarmonyBasicStyle(hmStyle, {
      key: "backgroundColor",
      useQuotes: true,
    }) +
    convertHarmonyBackgroundImage(hmStyle) +
    convertHarmonyBorderRadius(hmStyle) +
    convertHarmonyBorder(hmStyle) +
    convertHarmonyBoxShadow(hmStyle);

  return flex;
};

type HmStyle = Record<string, number | string>;

/** 转hm margin代码 */
const convertHarmonyMargin = (style: HmStyle) => {
  const { marginTop, marginRight, marginBottom, marginLeft } = style;
  let code = "";
  if (marginTop) {
    code += `top: ${marginTop},`;
  }
  if (marginRight) {
    code += `right: ${marginRight},`;
  }
  if (marginBottom) {
    code += `bottom: ${marginBottom},`;
  }
  if (marginLeft) {
    code += `left: ${marginLeft},`;
  }

  if (code) {
    return `.margin({${code}})`;
  }

  return "";
};

/** 转hm padding代码 */
const convertHarmonyPadding = (style: HmStyle) => {
  const { padding, paddingTop, paddingRight, paddingBottom, paddingLeft } =
    style;

  if (padding) {
    const values = String(style.borderRadius).split(" ");
    const length = values.length;
    const [first, second, third, fourth] = values;

    if (length === 1) {
      return `.padding(${removePx(values[0])})`;
    } else if (length === 2) {
      return `.padding(${JSON.stringify({
        top: removePx(first),
        right: removePx(second),
        bottom: removePx(first),
        left: removePx(second),
      })})`;
    } else if (length === 3) {
      return `.padding(${JSON.stringify({
        top: removePx(first),
        right: removePx(second),
        bottom: removePx(third),
        left: removePx(second),
      })})`;
    } else {
      return `.padding(${JSON.stringify({
        top: removePx(first),
        right: removePx(second),
        bottom: removePx(first),
        left: removePx(fourth),
      })})`;
    }
  }

  let code = "";
  if (paddingTop) {
    code += `top: ${removePx(paddingTop)},`;
  }
  if (paddingRight) {
    code += `right: ${removePx(paddingRight)},`;
  }
  if (paddingBottom) {
    code += `bottom: ${removePx(paddingBottom)},`;
  }
  if (paddingLeft) {
    code += `left: ${removePx(paddingLeft)},`;
  }

  if (code) {
    return `.padding({${code}})`;
  }

  return "";
};

/** 转hm width代码 */
const convertHarmonyWidth = (style: HmStyle) => {
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

/** 转hm height代码 */
const convertHarmonyHeight = (style: HmStyle) => {
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

/** 转hm flex代码 */
const convertHarmonyFlex = (style: HmStyle) => {
  if ("flex" in style) {
    return `.flexGrow(${style.flex})`;
  }
  return `.flexShrink(0)`;
};

const convertHarmonyBackgroundImage = (style: HmStyle) => {
  if (!("backgroundImage" in style)) {
    return "";
  }

  const backgroundImage = style.backgroundImage as string;

  if (backgroundImage.startsWith("url")) {
    const match = backgroundImage.match(/url\((["']?)([^)"']+)\1\)/);

    if (match) {
      return `.backgroundImage("${match[2]}")`;
    }

    return "";
  } else if (backgroundImage.startsWith("linear-gradient")) {
    return `.linearGradient(${JSON.stringify(parseLinearGradient(backgroundImage))})`;
  }

  return "";
};

const convertHarmonyBorderRadius = (style: HmStyle) => {
  if (!("borderRadius" in style)) {
    return "";
  }

  const values = String(style.borderRadius).split(" ");
  const length = values.length;
  const [first, second, third, fourth] = values;

  if (length === 1) {
    return `.borderRadius(${removePx(values[0])})`;
  } else if (length === 2) {
    return `.borderRadius(${JSON.stringify({
      topLeft: removePx(first),
      topRight: removePx(second),
      bottomRight: removePx(first),
      bottomLeft: removePx(second),
    })})`;
  } else if (length === 3) {
    return `.borderRadius(${JSON.stringify({
      topLeft: removePx(first),
      topRight: removePx(second),
      bottomRight: removePx(third),
      bottomLeft: removePx(second),
    })})`;
  } else {
    return `.borderRadius(${JSON.stringify({
      topLeft: removePx(first),
      topRight: removePx(second),
      bottomRight: removePx(third),
      bottomLeft: removePx(fourth),
    })})`;
  }
};

const BORDER_STYLE_HM_MAP: Record<string, string> = {
  solid: "BorderStyle.Solid",
  dashed: "BorderStyle.Dashed",
  dotted: "BorderStyle.Dotted",
};

const convertHarmonyBorder = (style: HmStyle) => {
  const { border, borderTop, borderRight, borderBottom, borderLeft } = style;

  if (border) {
    const { width, style, color } = parseBorder(border as string);
    return `.border({
      width: ${width},
      style: ${style},
      color: "${color}"
    })`;
  }

  let borderWidth = "";
  let borderStyle = "";
  let borderColor = "";

  [
    [borderTop, "top"],
    [borderRight, "right"],
    [borderBottom, "bottom"],
    [borderLeft, "left"],
  ].forEach(([border, key]) => {
    if (border) {
      const { width, style, color } = parseBorder(borderTop as string);
      borderWidth += `${key}: ${width},`;
      borderStyle += `${key}: ${style},`;
      borderColor += `${key}: "${color}",`;
    }
  });

  let code = "";

  if (borderWidth) {
    code += `.borderWidth({${borderWidth}})`;
  }
  if (borderStyle) {
    code += `.borderStyle({${borderStyle}})`;
  }
  if (borderColor) {
    code += `.borderColor({${borderColor}})`;
  }

  return code;
};

const convertHarmonyBoxShadow = (style: HmStyle) => {
  if (!("boxShadow" in style)) {
    return "";
  }

  const boxShadow = parseBoxShadow(style.boxShadow as string);

  return `.shadow(${JSON.stringify({
    offsetX: removePx(boxShadow.offsetX),
    offsetY: removePx(boxShadow.offsetY),
    color: boxShadow.color,
    radius: removePx(boxShadow.blurRadius),
    fill: boxShadow.inset,
  })})`;
};

/** 转hm 基础style（无特别操作来处理样式） */
const convertHarmonyBasicStyle = (
  style: HmStyle,
  config: {
    key: string;
    useQuotes: boolean;
  },
) => {
  const { key, useQuotes } = config;

  if (!(key in style)) {
    return "";
  }

  const quote = useQuotes ? '"' : "";

  return `.${key}(${quote}${style[key]}${quote})`;
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
    return parseFloat(str);
  }
  return `"${str}"`;
};

export const getPaddingCode = (
  componentStyle: Record<string, Record<string, string | number>>,
) => {
  const { root } = componentStyle;
  let paddingCode = "";

  if (root.paddingTop) {
    paddingCode += `top: ${root.paddingTop},`;
    delete root.paddingTop;
  }
  if (root.paddingRight) {
    paddingCode += `right: ${root.paddingRight},`;
    delete root.paddingRight;
  }
  if (root.paddingBottom) {
    paddingCode += `bottom: ${root.paddingBottom},`;
    delete root.paddingBottom;
  }
  if (root.paddingLeft) {
    paddingCode += `left: ${root.paddingLeft},`;
    delete root.paddingLeft;
  }
  if (paddingCode) {
    return `.padding({${paddingCode}})`;
  }

  return;
};

export * from "./pinyin";
export * from "./string";
export * from "./code";
