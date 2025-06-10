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

/** 将第一个字符转小写 */
export const firstCharToLowerCase = (str: string) => {
  return str.charAt(0).toLowerCase() + str.slice(1);
};

/** 将第一个字符转大写 */
export const firstCharToUpperCase = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

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

/** 组件样式转换(风格化、root根节点) */
export const convertComponentStyle = (style: Style) => {
  const resultStyle: Record<string, string | Record<string, string | number>> =
    {};
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
          resultStyle[selector] = css;
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
export const convertHarmonyFlex = (style: Style, config: { child: string }) => {
  const hmStyle = convertHMFlexStyle(style);
  const { direction, justifyContent, alignItems } = hmStyle;

  const flex =
    `Flex({
    direction: ${direction},
    justifyContent: ${justifyContent},
    alignItems: ${alignItems},
  }) {
    ${config.child}
  }` +
    convertHarmonyWidth(hmStyle) +
    convertHarmonyHeight(hmStyle) +
    convertHarmonyMargin(hmStyle) +
    convertHarmonyPadding(hmStyle);

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
  const { paddingTop, paddingRight, paddingBottom, paddingLeft } = style;
  let code = "";
  if (paddingTop) {
    code += `top: ${paddingTop},`;
  }
  if (paddingRight) {
    code += `right: ${paddingRight},`;
  }
  if (paddingBottom) {
    code += `bottom: ${paddingBottom},`;
  }
  if (paddingLeft) {
    code += `left: ${paddingLeft},`;
  }

  if (code) {
    return `.padding({${code}})`;
  }

  return "";
};

/** 转hm width代码 */
const convertHarmonyWidth = (style: HmStyle) => {
  let code = "";
  if ("width" in style) {
    code = `.width("${style.width}")`;
  }

  return code;
};

const convertHarmonyHeight = (style: HmStyle) => {
  let code = "";
  if ("height" in style) {
    code = `.height("${style.height}")`;
  }

  return code;
};

export * from "./hm";
export * from "./pinyin";
export * from "./string";
