import type { UI, BaseConfig } from "./index";
import {
  ImportManager,
  getName,
  convertComponentStyle,
  getModuleComponentCode,
  indentation,
} from "./utils";
import { handleProcess } from "./handleCom";

type Module = Extract<UI["children"][0], { type: "module" }>;

interface HandleModuleConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
  addComId: (comId: string) => void;
}

const handleModule = (module: Module, config: HandleModuleConfig): string => {
  const { events, moduleId } = module;
  const moduleScene = config.getSceneById(moduleId);

  const name = config.getFileName?.(moduleId) || getName(moduleScene.title);
  let comEventCode = "";

  const indent = indentation(config.codeStyle!.indent * (config.depth + 2));

  Object.entries(events).forEach(([eventId, { diagramId }]) => {
    if (!diagramId) {
      // 没有添加事件
      return;
    }

    const event = config.getEventByDiagramId(diagramId)!;

    if (!event) {
      // 在引擎内新建了事件后删除，存在脏数据
      return;
    }

    const defaultValue = "value";

    let process = handleProcess(event, {
      ...config,
      depth: config.depth + 3,
      addParentDependencyImport: config.addParentDependencyImport,
      getParams: () => {
        return {
          [eventId]: defaultValue,
        };
      },
    });

    if (process.includes("pageParams")) {
      config.addParentDependencyImport({
        packageName: config.getComponentPackageName(),
        dependencyNames: ["page"],
        importType: "named",
      });
      process =
        indentation(config.codeStyle!.indent * (config.depth + 3)) +
        `const pageParams: MyBricks.Any = page.getParams("${config.getCurrentScene().id}");\n` +
        process;
    }

    comEventCode +=
      `${indent}${eventId}: (${defaultValue}: MyBricks.EventValue) => {\n` +
      process +
      `\n${indent}},\n`;
  });

  config.addParentDependencyImport({
    packageName: "../sections/Index",
    dependencyNames: [name],
    importType: "named",
  });

  const configs = module.meta.model.data.configs;
  const currentProvider = config.getCurrentProvider();
  currentProvider.coms.add(module.meta.id);
  // 解决深浅色模式切换，数据重制等问题
  currentProvider.controllers.add(module.meta.id);
  const resultStyle = convertComponentStyle(module.props.style);
  const componentController =
    config.getComponentController?.({
      com: module.meta,
      scene: config.getCurrentScene(),
    }) || `controller_${module.meta.id}`;

  const uiComponentCode = getModuleComponentCode(
    {
      name,
      module,
      configs,
      resultStyle,
      currentProvider,
      componentController,
      comEventCode,
    },
    config,
  );

  return uiComponentCode;

  // return `${name}({
  //   uid: "${module.meta.id}",
  //   ${config.verbose ? `title: "${module.meta.title}",` : ""}
  //   ${configs ? `data: ${JSON.stringify(configs)},` : ""}
  //   controller: this.${currentProvider.name}.${componentController},
  //   styles: ${JSON.stringify(resultStyle)},
  //   ${
  //     comEventCode
  //       ? `events: {
  //     ${comEventCode}
  //   }`
  //       : ""
  //   }
  // })`;
};

export default handleModule;
