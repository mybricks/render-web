/* eslint-disable @typescript-eslint/no-explicit-any */
import prettier from "prettier";
import parserBabel from "prettier/parser-babel";
import parserPostCSS from "prettier/parser-postcss";

export const initComdefs = () => {
  const regAry = (comAray: any, comDefs: any) => {
    comAray.forEach((comDef: any) => {
      if (comDef.comAray) {
        regAry(comDef.comAray, comDefs);
      } else {
        comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
      }
    });
  };

  const comDefs = {};
  const comLibs = [...((window as any)["__comlibs_edit_"] || [])];

  comLibs.forEach((lib) => {
    const comAray = lib.comAray;
    if (comAray && Array.isArray(comAray)) {
      regAry(comAray, comDefs);
    }
  });

  return comDefs;
};

const PARSER_PLUGINS: any = {
  babel: {
    semi: true, // 分号
    singleQuote: true,
    // jsxSingleQuote: true,
    tabWidth: 2,
    useTabs: false,
    printWidth: 120,
    trailingComma: "none",
    bracketSpacing: true,
    arrowParens: "always",
    parser: "babel",
    plugins: [parserBabel],
  },
  less: {
    parser: "less",
    plugins: [parserPostCSS],
  },
};
export const codePrettier = (
  content: string,
  parser: keyof typeof PARSER_PLUGINS,
) => {
  return prettier.format(content, PARSER_PLUGINS[parser]);
};

// export const codePrettier = (content: string, _: any): string => {
//   return content;
// };

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
  private _styleImports: string[] = [];

  /** 添加样式文件引入（放在所有 import 最后） */
  addStyleImport(packageName: string) {
    if (packageName) {
      this._styleImports.push(packageName);
    }
  }

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
    const codePart = Object.entries(this._imports).reduce(
      (pre, [packageName, dependencies]) => {
        let defaultDependency = "";
        let namedDependencies = "";

        const dependencyEntries = Object.entries(dependencies);

        dependencyEntries.forEach(([dependencyName, { importType }]) => {
          if (importType === "default") {
            defaultDependency = dependencyName;
          } else {
            namedDependencies += `${namedDependencies ? ", " : ""}${dependencyName}`;
          }
        });

        if (namedDependencies) {
          namedDependencies = `{ ${namedDependencies} }`;

          if (defaultDependency) {
            defaultDependency += ", ";
          }
        }

        if (!defaultDependency && !namedDependencies) {
          return pre + `import '${packageName}';\n`;
        }

        return (
          pre +
          `import ${defaultDependency}${namedDependencies} from '${packageName}';\n`
        );
      },
      "",
    );
    const stylePart = this._styleImports
      .map((p) => `import '${p}';\n`)
      .join("");
    return codePart + stylePart;
  }
}

export function convertCamelToHyphen(str: string) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * 将 id/名称 转为安全的路径片段（目录名、文件名），避免 UUID 或特殊字符导致的问题。
 * 仅保留 [a-zA-Z0-9_-]，其余替换为 _；若以数字开头则加前缀 p_
 */
export function toSafeFileName(str: string): string {
  if (!str) return "unnamed";
  const safe = str.replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (!safe) return "unnamed";
  return /^[0-9]/.test(safe) ? `p_${safe}` : safe;
}

export * from "./getUtilsFiles";
