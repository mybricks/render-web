import type { Style } from "../toCode/types";

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

/** 收集依赖 */
export const createDependencyImportCollector = () => {
  const dependencyImport: DependencyImport = {};

  const addDependencyImport = ({
    packageName,
    dependencyNames,
    importType,
  }: {
    packageName: string;
    dependencyNames: string[];
    importType: ImportType;
  }) => {
    if (!dependencyImport[packageName]) {
      dependencyImport[packageName] = {};
    }

    dependencyNames.forEach((dependencyName) => {
      dependencyImport[packageName][dependencyName] = {
        importType,
      };
    });
  };

  return [dependencyImport, addDependencyImport] as [
    typeof dependencyImport,
    typeof addDependencyImport,
  ];
};

/** 解析依赖为code */
export const generateImportDependenciesCode = (
  dependencyImport: DependencyImport,
) => {
  return Object.entries(dependencyImport).reduce(
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
};

const HM_STYLE_MAP: Record<string, Record<string, string>> = {
  layout: {
    "flex-column": "FlexDirection.Column",
    "flex-row": "FlexDirection.Row",
    default: "FlexDirection.Column",
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

export const convertHMFlexStyle = (style: Style) => {
  return convertHMStyle(
    Object.assign(
      {
        layout: "flex-column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        width: "100%",
        height: "fit-content",
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

  return resultStyle;
};
