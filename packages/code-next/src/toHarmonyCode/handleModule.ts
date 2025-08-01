import type { UI, BaseConfig } from "./index";
import { ImportManager, getName, convertComponentStyle } from "./utils";

type Module = Extract<UI["children"][0], { type: "module" }>;

interface HandleModuleConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
  addComId: (comId: string) => void;
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

  const configs = module.meta.model.data.configs;
  const currentProvider = config.getCurrentProvider();
  currentProvider.coms.add(module.meta.id);

  const resultStyle = convertComponentStyle(module.props.style);

  return `${name}({
    uid: "${module.meta.id}",
    ${config.verbose ? `title: "${module.meta.title}",` : ""}
    ${configs ? `data: ${JSON.stringify(configs)},` : ""}
    controller: this.${currentProvider.name}.controller_${module.meta.id},
    styles: ${JSON.stringify(resultStyle)},
  })`;
};

export default handleModule;
