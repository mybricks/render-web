import type { UI, BaseConfig } from "./index";
import { ImportManager, getName } from "./utils";

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

  console.log("module => ", module);

  config.addParentDependencyImport({
    packageName: "../sections",
    dependencyNames: [name],
    importType: "named",
  });

  return `${name}()`;
};

export default handleModule;
