/**
 * 处理全局变量和全局Fx
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import { ImportManager, firstCharToUpperCase } from "./utils";
import { handleProcess } from "./handleCom";
import type { ToJSON } from "../toCode/types";
import type { ToSpaCodeConfig, Result } from "./index";

interface HandleGlobalParams {
  tojson: ToJSON;
  globalFxs: ReturnType<typeof toCode>["globalFxs"];
  globalVars: ReturnType<typeof toCode>["globalFxs"];
}

const handleGlobal = (params: HandleGlobalParams, config: ToSpaCodeConfig) => {
  const { tojson, globalFxs, globalVars } = params;
  const globalImportManager = new ImportManager();
  const globalAddDependencyImport =
    globalImportManager.addImport.bind(globalImportManager);

  let globalVarsInitCode = "";
  let globalVarsResetCode = "";
  let globalVarsParamsCode = "";

  Object.entries(tojson.global.comsReg).forEach(([, com]) => {
    if (com.def.namespace !== "mybricks.core-comlib.var") {
      // 非变量，不需要初始化
      return;
    }

    const event = globalVars.find((globalVar) => {
      return globalVar.meta.id === com.id;
    })!;

    const res = handleProcess(event, {
      getParams: () => {
        return {
          [event.paramId]: "value",
        };
      },
      getComponentPackageName: (props: any) => {
        if (props?.meta.global) {
          return "";
        }
        return "./Index";
      },
      addParentDependencyImport: globalAddDependencyImport,
      getComponentMetaByNamespace: config.getComponentMetaByNamespace,
    } as any);

    globalImportManager.addImport({
      packageName: "../utils/types",
      dependencyNames: ["MyBricks"],
      importType: "named",
    });
    globalImportManager.addImport({
      packageName: "../utils/mybricks",
      dependencyNames: ["createVariable"],
      importType: "named",
    });

    const constantName = `globalVar${firstCharToUpperCase(com.title)}Params`;

    globalVarsParamsCode += `const ${constantName} = [${JSON.stringify(com.model.data.initValue)}, (value: MyBricks.EventValue) => {
      ${res}
    }]\n`;

    globalVarsInitCode += `${com.title} = createVariable(...${constantName})\n`;
    globalVarsResetCode += `this.${com.title} = createVariable(...${constantName})\n`;
  });

  let globalFxsInitCode = "";
  globalFxs.forEach((event) => {
    globalImportManager.addImport({
      packageName: "../utils/types",
      dependencyNames: ["MyBricks"],
      importType: "named",
    });
    globalImportManager.addImport({
      packageName: "../utils/mybricks",
      dependencyNames: ["createFx"],
      importType: "named",
    });
    const res = handleProcess(event, {
      getParams: () => {
        return event.paramPins.reduce(
          (pre, cur, index) => {
            // 由于是数组，可以转成简单的value加参数位置下标
            pre[cur.id] = `value${index}`;

            return pre;
          },
          {} as Record<string, string>,
        );
      },
      getComponentPackageName: (props: any) => {
        if (props?.meta.global) {
          return "";
        }
        return "./Index";
      },
      addParentDependencyImport: globalAddDependencyImport,
      getComponentMetaByNamespace: config.getComponentMetaByNamespace,
    } as any);

    /** 入参 */
    const values = event.paramPins
      .map((paramPin, index) => {
        if (paramPin.type === "config") {
          // 配置的默认值
          return `value${index}: MyBricks.EventValue = ${JSON.stringify(event.initValues[paramPin.id])}`;
        }

        return `value${index}: MyBricks.EventValue`;
      })
      .join(", ");

    /** 结果interface定义 */
    const returnInterface = event.frameOutputs.length
      ? `interface Return {
    ${event.frameOutputs
      .map((frameOutput: any) => {
        return `/** ${frameOutput.title} */
      ${frameOutput.id}: MyBricks.EventValue`;
      })
      .join("\n")}}`
      : "";

    globalFxsInitCode += `/** ${event.title} */
    ${event.frameId} = createFx((${values}) => {
      ${returnInterface}
      ${res} ${returnInterface ? "as Return" : ""}
    })
    `;
  });

  return {
    type: "global",
    content: `${globalImportManager.toCode()}
    
      /**
        * 全局变量
        */
      ${globalVarsParamsCode}
      class GlobalVars {
        ${globalVarsInitCode}

        reset() {
          ${globalVarsResetCode}
        }
      }

      export const globalVars = new GlobalVars()


      /**
        * 全局Fx
        */      
      class GlobalFxs {
        ${globalFxsInitCode}
      }

      export const globalFxs = new GlobalFxs()
    `,
    importManager: globalImportManager,
    name: "global",
  } as Result[0];
};

export default handleGlobal;
