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
// export const codePrettier = (
//   content: string,
//   parser: keyof typeof PARSER_PLUGINS,
// ) => {
//   return prettier.format(content, PARSER_PLUGINS[parser]);
// };

export const codePrettier = (content: string, _: any): string => {
  return content;
};

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

        const dependencyEntries = Object.entries(dependencies);

        dependencyEntries.forEach(([dependencyName, { importType }], index) => {
          if (importType === "default") {
            defaultDependency = dependencyName;
          } else {
            namedDependencies += `${index ? ", " : ""}${dependencyName}`;
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
  }
}

export function convertCamelToHyphen(str: string) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
