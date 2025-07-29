import type { UI, BaseConfig } from "./index";
import { ImportManager, getName, convertComponentStyle } from "./utils";

type Module = Extract<UI["children"][0], { type: "module" }>;

interface HandleModuleConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addController: (controller: string) => void;
  addConsumer: (provider: { name: string; class: string }) => void;
}

// type HandleModuleResult = {
//   ui: string;
//   js: string;
//   slots: string[];
//   scopeSlots: string[];
// };

const handleModule = (module: Module, config: HandleModuleConfig): string => {
  const name = getName(module.meta.title);

  config.addParentDependencyImport({
    packageName: "../sections",
    dependencyNames: [name],
    importType: "named",
  });
  config.addController(module.meta.id);

  const configs = module.meta.model.data.configs;
  const currentProvider = config.getCurrentProvider();
  const usedControllers = config.getUsedControllers();

  const resultStyle = convertComponentStyle(module.props.style);

  return `${name}({
    uid: "${module.meta.id}",
    ${config.verbose ? `title: "${module.meta.title}",` : ""}
    ${configs ? `data: ${JSON.stringify(configs)},` : ""}
    styles: ${JSON.stringify(resultStyle)},
    ${usedControllers.has(module.meta.id) ? `controller: this.${currentProvider.name}.controller_${module.meta.id},` : ""}
  })`;
};

export default handleModule;
