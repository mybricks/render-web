/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import { initComdefs, codePrettier, ImportManager } from "./utils";

interface ToTargetCodeConfig {
  target: "react";
}

export interface BaseConfig extends ToTargetCodeConfig {
  TODO?: "Hello";
  getComDef: (def: { namespace: string; version: string }) => any;
  setComTarget: (id: string, target: any) => void;
  importManager: ImportManager;
}

const toTargetCode = (
  tojson: ToJSON,
  config: ToTargetCodeConfig,
): ReturnType<typeof toCode> => {
  const toCodejson = toCode(tojson);
  console.log("[@toCodejson]", toCodejson);
  console.log("[@config]", config);
  console.log("[@comDefs]", initComdefs());

  const baseConfig = transformConfig(config);
  const { scenes } = toCodejson;

  scenes.forEach((scene) => {
    const importManager = new ImportManager();
    const comIdToTargetMap: any = {};

    if (config.target === "react") {
      importManager.addImport({
        packageName: "react",
        dependencyNames: ["React"],
        importType: "default",
      });
    }

    const { jsx, css } = handleSlot(scene.ui, {
      ...baseConfig,
      setComTarget(id: string, target: any) {
        comIdToTargetMap[id] = target;
      },
      importManager,
    });

    console.log("[result]", {
      jsx: codePrettier(
        `${importManager.toCode()}
        export default function () {
          return ${jsx}
        }`,
        "babel",
      ),
      css: codePrettier(css, "less"),
    });
  });

  return toCodejson;
};

export default toTargetCode;

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];

const transformConfig = (config: ToTargetCodeConfig) => {
  const comDefs: any = initComdefs();
  return {
    ...config,
    getComDef: (def: { namespace: string; version: string }) => {
      return comDefs[`${def.namespace}-${def.version}`];
    },
  };
};
