/* eslint-disable @typescript-eslint/no-explicit-any */
import prettier from "prettier";
import parserBabel from "prettier/parser-babel";

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

export const codePrettier = (content: string) => {
  return prettier.format(content, { parser: "babel", plugins: [parserBabel] });
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

        return (
          pre +
          `import ${defaultDependency}${namedDependencies} from '${packageName}';\n`
        );
      },
      "",
    );
  }
}
