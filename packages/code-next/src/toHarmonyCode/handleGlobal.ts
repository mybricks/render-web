/**
 * 处理全局变量和全局Fx
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import { ImportManager, firstCharToUpperCase, indentation } from "./utils";
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
  const globalImportManager = new ImportManager(config);
  const globalAddDependencyImport =
    globalImportManager.addImport.bind(globalImportManager);

  let globalVarsInitCode = "";
  let globalVarsResetCode = "";
  let globalVarsParamsCode = "";

  const indent = indentation(config.codeStyle!.indent);
  const indent2 = indentation(config.codeStyle!.indent * 2);
  const indent3 = indentation(config.codeStyle!.indent * 3);

  Object.entries(tojson.global.comsReg).forEach(([, com]) => {
    if (com.def.namespace !== "mybricks.core-comlib.var") {
      // 非变量，不需要初始化
      return;
    }

    const event = globalVars.find((globalVar) => {
      return globalVar.meta.id === com.id;
    })!;

    const res = handleProcess(event, {
      ...config,
      depth: 2,
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
      getComponentMeta: config.getComponentMeta,
    } as any);

    const initFunctionName = `init${firstCharToUpperCase(com.title)}`;

    globalVarsParamsCode +=
      `\nconst ${initFunctionName} = () => {` +
      `\n${indent}return createVariable(${JSON.stringify(com.model.data.initValue)}, (value: MyBricks.EventValue) => {` +
      `\n${res}` +
      `\n${indent}}) as MyBricks.Controller` +
      `\n}\n`;

    globalVarsInitCode += `${indent}${com.title}: MyBricks.Controller = ${initFunctionName}()\n`;
    globalVarsResetCode += `${indent2}this.${com.title} = ${initFunctionName}()\n`;
  });

  let globalFxsInitCode = "";
  globalFxs.forEach((event) => {
    const currentScene = tojson.global.fxFrames.find(
      (fxFrame) => fxFrame.id === event.frameId,
    );
    const res = handleProcess(event, {
      ...config,
      depth: 2,
      getCurrentScene: () => {
        return currentScene;
      },
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
      getComponentMeta: config.getComponentMeta,
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
      ? `${indent2}interface Return {` +
        `\n${event.frameOutputs.reduce((pre: string, frameOutput: any) => {
          return (
            pre +
            (`${indent3}/** ${frameOutput.title} */` +
              `\n${indent3}${frameOutput.id}: MyBricks.EventValue\n`)
          );
        }, "")}` +
        `${indent2}}`
      : "";

    globalFxsInitCode +=
      `${indent}/** ${event.title} */` +
      `\n${indent}${event.frameId}: MyBricks.Api = createFx((${values}) => {` +
      (returnInterface ? `\n${returnInterface}` : "") +
      `\n${res}${returnInterface ? " as Return" : ""}` +
      `\n${indent}})\n`;
  });

  const varCode =
    "/** 全局变量 */" +
    `${globalVarsParamsCode}` +
    `\nclass GlobalVars {` +
    `\n${globalVarsInitCode}` +
    `\n${indent}reset() {` +
    `\n${globalVarsResetCode}` +
    `${indent}}` +
    `\n}` +
    `\n\nexport const globalVars = new GlobalVars()`;

  const fxCode =
    "/** 全局Fx */" +
    `\nclass GlobalFxs {` +
    `\n${globalFxsInitCode}` +
    `}` +
    `\n\nexport const globalFxs = new GlobalFxs()`;

  return {
    type: "global",
    content: varCode + "\n\n" + fxCode,
    importManager: globalImportManager,
    name: "global",
  } as Result[0];
};

export default handleGlobal;
