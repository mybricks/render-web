/* eslint-disable @typescript-eslint/no-explicit-any */
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

        const dependencyEntries = Object.entries(dependencies);

        /** 超过三项换行 */
        const wrap = dependencyEntries.length > 3;

        dependencyEntries.forEach(([dependencyName, { importType }], index) => {
          if (importType === "default") {
            defaultDependency = dependencyName;
          } else {
            if (wrap) {
              namedDependencies +=
                `${index ? ",\n" : ""}` + ` ${dependencyName}`;
            } else {
              namedDependencies += `${index ? ", " : ""}${dependencyName}`;
            }
          }
        });

        if (namedDependencies) {
          if (wrap) {
            namedDependencies = `{\n${namedDependencies}\n}`;
          } else {
            namedDependencies = `{ ${namedDependencies} }`;
          }

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

const indent = (level = 1) => {
  if (level === 1) {
    return "  ";
  } else {
    return "  ".repeat(level);
  }
};

export const getClassCode = (params: any) => {
  const { filterControllers, currentProvider, scene, config, title } = params;

  if (
    filterControllers.length ||
    currentProvider.useParams ||
    currentProvider.useEvents
  ) {
    // class不存在嵌套，默认缩进两个空格
    const indentation = indent();
    let classCode = "";

    if (currentProvider.useParams) {
      classCode += `${indentation}/** 插槽参数 */\n${indentation}params: MyBricks.Any\n`;
    }
    if (currentProvider.useEvents) {
      classCode += `${indentation}/** 事件 */\n${indentation}events: MyBricks.Events = {}\n`;
    }
    if (filterControllers.length) {
      classCode += filterControllers.reduce((pre: any, cur: any) => {
        const com = scene.coms[cur];
        const controllerName =
          config.getComponentController?.({ com, scene }) ||
          `controller_${com.id}`;
        const controllerFn =
          com.def.namespace === "mybricks.core-comlib.module" ||
          com.def.namespace.startsWith("mybricks.harmony.module.")
            ? "ModuleController()"
            : "Controller()";
        return (
          pre +
          `${indentation}/** ${com.title} */\n${indentation}${controllerName} = ${controllerFn}\n`
        );
      }, "");
    }

    return (
      `/** ${title} */\n` + `class ${currentProvider.class} {\n${classCode}}\n`
    );
  }

  return "";
};

export const providerCode = (params: any) => {

}

export const getSlotComponentCode = (params: any) => {
  const {
    scene,
    isModule,
    config,
    providerCode,
    effectEventCode,
    jsCode,
    level0SlotsCode,
    uiCode,
    level1Slots,
  } = params;
  const indentation1 = indent(1);
  const indentation2 = indent(2);

  let slotComponentCode = "";

  slotComponentCode += `${isModule ? "export default " : ""}struct Index {`;
  slotComponentCode += `${isModule ? `\n${indentation1}@Param uid: string = ""` : ""}`;
  slotComponentCode += `${isModule && config.verbose ? `\n${indentation1}@Param title: string = "${scene.title}"` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation1}@Param data: MyBricks.Data = {}` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation1}@Param controller: MyBricks.ModuleController = ModuleController()` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation1}@Param styles: Styles = {}` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation1}@Param events: MyBricks.Events = {}` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation1}@Local columnVisibilityController: ColumnVisibilityController = new ColumnVisibilityController()` : ""}`;
  slotComponentCode += `\n${providerCode}`;
  slotComponentCode += `${isModule ? `\n${indentation1}myBricksColumnModifier = new MyBricksColumnModifier(this.styles.root)` : ""}`;
  slotComponentCode += effectEventCode ? `${effectEventCode}\n\n` : "";
  slotComponentCode += jsCode;
  slotComponentCode += level0SlotsCode;

  return (
    `/** ${scene.title} */\n@ComponentV2\n` +
    slotComponentCode +
    `${indentation1}build() {\n` +
    `${indentation2}Column() {\n${uiCode}\n${indentation2}}\n` +
    (isModule
      ? `${indentation2}.attributeModifier(this.myBricksColumnModifier)\n${indentation2}.visibility(this.columnVisibilityController.visibility)`
      : `${indentation2}.width("100%")\n${indentation2}.height("100%")\n`) +
    `${indentation1}}\n}` +
    level1Slots.join("\n")
  );
};
