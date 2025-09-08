/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPaddingCode } from "./index";
import { ToSpaCodeConfig } from "../index";
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

  constructor(private _config: ToSpaCodeConfig) {}

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
    const indent = indentation(this._config.codeStyle!.indent);
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
              namedDependencies += `${indent}${dependencyName},\n`;
              // namedDependencies +=
              //   `${index ? ",\n" : ""}` + ` ${dependencyName}`;
            } else {
              namedDependencies += `${index ? ", " : ""}${dependencyName}`;
            }
          }
        });

        if (namedDependencies) {
          if (wrap) {
            namedDependencies = `{\n${namedDependencies}}`;
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

/** 缩进 */
export const indentation = (level: number) => {
  return " ".repeat(level);
};

/**
 * 各种类声明
 * 组件控制器
 * fxs
 * vars
 */
export const getClassCode = (params: any) => {
  const { filterControllers, currentProvider, scene, config, title } = params;

  if (
    filterControllers.length ||
    currentProvider.useParams ||
    currentProvider.useEvents
  ) {
    // class不存在嵌套，默认缩进两个空格
    const indentation2 = indentation(2);
    let classCode = "";

    if (currentProvider.useParams) {
      classCode += `${indentation2}/** 插槽参数 */\n${indentation2}params: MyBricks.Any\n`;
    }
    if (currentProvider.useEvents) {
      classCode += `${indentation2}/** 事件 */\n${indentation2}events: MyBricks.Events = {}\n`;
    }
    if (currentProvider.useController) {
      classCode += `${indentation2}/** 区块控制器 */\n${indentation2}controller = ModuleController()\n`;
    }
    if (currentProvider.useData) {
      classCode += `${indentation2}/** 区块配置 */\n${indentation2}data: MyBricks.Any;\n`;
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
          `${indentation2}/** ${com.title} */\n${indentation2}${controllerName} = ${controllerFn}\n`
        );
      }, "");
    }

    return (
      `/** ${title} */\n` + `class ${currentProvider.class} {\n${classCode}}\n`
    );
  }

  return "";
};

/** 组件的Provider声明 */
export const getProviderCode = (params: any, config: any) => {
  const { filterControllers, currentProvider, vars, fxs } = params;
  let providerCode =
    filterControllers.length ||
    currentProvider.useParams ||
    currentProvider.useEvents
      ? `${indentation(config.codeStyle.indent)}@Provider() ${currentProvider.name}: ${currentProvider.class} = new ${currentProvider.class}()`
      : "";
  if (vars) {
    providerCode += `\n${vars.varsImplementCode}`;
  }
  if (fxs) {
    providerCode += `\n${fxs.fxsImplementCode}`;
  }

  return providerCode;
};

/** 画布组件代码 */
export const getSlotComponentCode = (params: any, config: any) => {
  const {
    scene,
    isModule,
    providerCode,
    effectEventCode,
    jsCode,
    level0SlotsCode,
    uiCode,
    level1Slots,
  } = params;
  const configIndent = config.codeStyle!.indent;
  const indentation2 = indentation(configIndent);
  const indentation4 = indentation(configIndent * 2);

  let slotComponentCode = "";

  slotComponentCode += `${isModule ? "export default " : ""}struct Index {`;
  slotComponentCode += `${isModule ? `\n${indentation2}@Param uid: string = ""` : ""}`;
  slotComponentCode += `${isModule && config.verbose ? `\n${indentation2}@Param title: string = "${scene.title}"` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation2}@Param data: MyBricks.Data = {}` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation2}@Param controller: MyBricks.ModuleController = ModuleController()` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation2}@Param styles: Styles = {}` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation2}@Param events: MyBricks.Events = {}` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation2}@Local columnVisibilityController: ColumnVisibilityController = new ColumnVisibilityController()` : ""}`;
  slotComponentCode += `${isModule ? `\n${indentation2}@BuilderParam empty: () => void = empty` : ""}`;
  slotComponentCode += providerCode ? `\n${providerCode}` : "";
  slotComponentCode += `${isModule ? `\n${indentation2}myBricksColumnModifier = new MyBricksColumnModifier(this.styles.root)` : ""}`;
  slotComponentCode += effectEventCode ? `\n\n${effectEventCode}` : "";
  slotComponentCode += jsCode ? `\n\n${jsCode}` : "";
  slotComponentCode += level0SlotsCode ? `\n\n${level0SlotsCode}` : "";

  return (
    (isModule ? "@Builder\nfunction empty() {\n}\n\n" : "") +
    `/** ${scene.title} */\n@ComponentV2\n` +
    (slotComponentCode ? `${slotComponentCode}\n\n` : "") +
    `${indentation2}build() {\n` +
    `${indentation4}Column() {\n${uiCode}\n${indentation4}}\n` +
    (isModule
      ? `${indentation4}.attributeModifier(this.myBricksColumnModifier)\n${indentation4}.visibility(this.columnVisibilityController.visibility)\n`
      : `${indentation4}.width("100%")\n${indentation4}.height("100%")\n`) +
    `${indentation2}}\n}` +
    level1Slots.join("\n")
  );
};

interface GenObjectCodeConfig {
  initialIndent: number;
  indentSize: number;
}
/** 处理对象，转格式化字符串 */
export const genObjectCode = (
  object: any,
  config: GenObjectCodeConfig,
): string => {
  const { initialIndent, indentSize } = config;
  const indent = (level: number) => " ".repeat(level);

  const formatValue = (value: any, level: number): string => {
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      let arrStr = "[\n";
      value.forEach((item, idx) => {
        arrStr +=
          indent(level + indentSize) + formatValue(item, level + indentSize);
        if (idx < value.length - 1) arrStr += ",";
        arrStr += "\n";
      });
      arrStr += indent(level) + "]";
      return arrStr;
    } else if (value && typeof value === "object") {
      return genObjectCode(value, { initialIndent: level, indentSize });
    } else if (typeof value === "string") {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  };

  const keys = Object.keys(object);
  if (keys.length === 0) return "{}";

  let result = "{\n";
  keys.forEach((key, idx) => {
    result +=
      indent(initialIndent + indentSize) +
      `${JSON.stringify(key)}: ${formatValue(object[key], initialIndent + indentSize)}`;
    if (idx < keys.length - 1) result += ",";
    result += "\n";
  });
  result += indent(initialIndent) + "}";
  return result;
};

/** ui组件代码 */
export const getUiComponentCode = (params: any, config: any) => {
  const {
    isModule,
    componentName,
    meta,
    currentProvider,
    componentController,
    props,
    resultStyle,
    slotsName,
    comEventCode,
  } = params;
  const paddingCode = getPaddingCode(resultStyle, {
    initialIndent: config.codeStyle!.indent * config.depth,
    indentSize: config.codeStyle!.indent,
  });
  const initialIndent =
    config.codeStyle!.indent * (config.depth + (paddingCode ? 1 : 0));
  const indent = indentation(initialIndent);
  const indent2 = indentation(initialIndent + config.codeStyle!.indent);

  let ui =
    `${indent}/** ${meta.title} */` +
    `\n${indent}${componentName}({` +
    `\n${indent2}uid: "${meta.id}",` +
    (config.verbose ? `\n${indent2}title: "${meta.title}",` : "") +
    `\n${indent2}controller: this.${currentProvider.name}.${componentController},` +
    `\n${indent2}data: ${genObjectCode(
      isModule ? meta.model.data.config : props.data,
      {
        initialIndent: initialIndent + config.codeStyle!.indent,
        indentSize: config.codeStyle!.indent,
      },
    )},` +
    `\n${indent2}styles: ${genObjectCode(resultStyle, {
      initialIndent: initialIndent + config.codeStyle!.indent,
      indentSize: config.codeStyle!.indent,
    })},` +
    (slotsName ? `\n${indent2}slots: this.${slotsName}.bind(this),` : "") +
    (comEventCode
      ? `\n${indent2}events: {\n` + comEventCode + `${indent2}},`
      : "") +
    (meta.frameId && !isModule ? `\n${indent2}parentSlot: this.params,` : "") +
    `\n${indent}})`;

  if (paddingCode) {
    const indent = indentation(config.codeStyle!.indent * config.depth);
    ui = `${indent}Column() {\n` + ui + `\n${indent}}` + paddingCode;
  }

  return ui;
};

/** 模块组件代码 */
export const getModuleComponentCode = (params: any, config: any) => {
  const {
    name,
    module,
    configs,
    resultStyle,
    currentProvider,
    componentController,
    comEventCode,
  } = params;
  const initialIndent = config.codeStyle!.indent * config.depth;
  const indent = indentation(initialIndent);
  const indent2 = indentation(initialIndent + config.codeStyle!.indent);

  return (
    `${indent}${name}({` +
    `\n${indent2}uid: "${module.meta.id}",` +
    (config.verbose ? `\n${indent2}title: "${module.meta.title}",` : "") +
    (configs
      ? `\n${indent2}data: ${genObjectCode(configs, {
          initialIndent: initialIndent + config.codeStyle!.indent,
          indentSize: config.codeStyle!.indent,
        })},`
      : "") +
    `\n${indent2}controller: this.${currentProvider.name}.${componentController},` +
    `\n${indent2}styles: ${genObjectCode(resultStyle, {
      initialIndent: initialIndent + config.codeStyle!.indent,
      indentSize: config.codeStyle!.indent,
    })},` +
    (comEventCode
      ? `\n${indent2}events: {\n` + comEventCode + `${indent2}},`
      : "") +
    `\n${indent}})`
  );
};

/** 插槽Builder代码 */
export const getBuilderCode = (params: any, config: any) => {
  const { meta, slotsName, currentSlotsCode } = params;
  const indent = indentation(config.codeStyle!.indent);

  return (
    `${indent}/** ${meta.title}插槽 */\n` +
    `${indent}@Builder\n` +
    `${indent}${slotsName}(params: MyBricks.SlotParams) {\n` +
    currentSlotsCode +
    `\n${indent}}`
  );
};

/** 作用域插槽组件代码 */
export const getSlotScopeComponentCode = (params: any, config: any) => {
  const {
    meta,
    slot,
    scopeSlotComponentName,
    consumers,
    providerCode,
    js,
    slotsCode,
    uiCode,
  } = params;

  const indent = indentation(config.codeStyle.indent);

  const consumersCode = Array.from(consumers)
    .filter(
      // [TODO] 过滤同名，下一版将consumers改成字符串列表
      (consumer: any, index: any, consumers: any) =>
        index === consumers.findIndex((t: any) => t.name === consumer.name),
    )
    .reduce((pre, provider: any) => {
      return (
        pre +
        `\n${indent}@Consumer("${provider.name}") ${provider.name}: ${provider.class} = new ${provider.class}()`
      );
    }, "");

  return (
    `/** ${meta.title}（${slot.meta.title}） */` +
    "\n@ComponentV2" +
    `\nstruct ${scopeSlotComponentName} {` +
    `\n${indent}@Param @Require params: MyBricks.SlotParams` +
    (providerCode ? `\n${providerCode}` : "") +
    (consumersCode ? consumersCode : "") +
    (js ? `\n\n${js}` : "") +
    (slotsCode ? `\n\n${slotsCode}` : "") +
    `\n\n${indent}build() {\n` +
    uiCode +
    `\n${indent}}` +
    "\n}"
  );
};
