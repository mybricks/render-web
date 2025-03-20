import { createDependencyImportCollector } from "./utils";
import { handleProcess } from "./handleCom";

import type { UI, BaseConfig } from "./index";

export type Module = Extract<UI["children"][0], { type: "module" }>;

type HandleModuleResult = {
  ui: string;
  js: string;
};

export interface HandleModuleConfig extends BaseConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addRefName: (refName: string) => void;
  addSlotContext: (slotContext: string) => void;
}

const handleModule = (
  module: Module,
  config: HandleModuleConfig,
): HandleModuleResult => {
  const { meta, props, events, moduleId } = module;
  config.addParentDependencyImport({
    packageName: "react",
    dependencyName: "useRef",
    importType: "named",
  });
  const moduleRelativePathMap = config.getModuleRelativePathMap();
  const componentName = `Module_${moduleId}`;
  config.addParentDependencyImport({
    packageName: `${moduleRelativePathMap[moduleId]}modules/${componentName}`,
    dependencyName: componentName,
    importType: "default",
  });
  const componentNameWithId = `${componentName}_${meta.id}`;
  config.addRefName(componentNameWithId);

  let propsCode = Object.entries(props).reduce((pre, [key, value]) => {
    return pre + `${key}={${JSON.stringify(value)}} `;
  }, `ref={${componentNameWithId}_ref}`);

  let eventCode = "";

  Object.entries(events).forEach(([eventId, { diagramId }]) => {
    if (eventId === "click") {
      // 内置的click，忽略
      return;
    }
    propsCode += `${eventId}={${componentNameWithId}_${eventId}}`;
    const event = config.getEventByDiagramId(diagramId)!;
    const defaultValue = "value";

    eventCode += `const ${componentNameWithId}_${eventId} = (${defaultValue}) => {
      ${handleProcess(event, {
        ...config,
        addParentDependencyImport: config.addParentDependencyImport,
        getParams: () => {
          return {
            [eventId]: defaultValue,
          };
        },
      })}
    }\n`;
  });

  return {
    ui: `<${componentName} ${propsCode}/>`,
    js: eventCode,
  };
};

export default handleModule;
