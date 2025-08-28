/**
 * 处理Extension事件卡片
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import { ImportManager, indentation } from "./utils";
import { handleProcess } from "./handleCom";
import type { ToSpaCodeConfig, Result } from "./index";

interface HandleExtensionParams {
  extensionEvents: ReturnType<typeof toCode>["extensionEvents"];
}

const handleExtension = (
  params: HandleExtensionParams,
  config: ToSpaCodeConfig,
) => {
  const { extensionEvents } = params;
  const result: Result = [];
  const importManager = new ImportManager(config);
  const addDependencyImport = importManager.addImport.bind(importManager);

  const extensionBusImportManager = new ImportManager(config);
  const addExtensionBusDependencyImport =
    extensionBusImportManager.addImport.bind(extensionBusImportManager);
  let extensionBusInitCode = "";

  extensionEvents.forEach((extension) => {
    const { meta, events } = extension;
    events.forEach((event) => {
      const { isExtensionConfig, isExtensionApi, isExtensionBus } =
        getExtensionType(event.type);
      const params = isExtensionConfig
        ? event.paramPins.reduce<Record<string, string>>((pre, cur) => {
            pre[cur.id] = `value.${cur.id}`;
            return pre;
          }, {})
        : {
            open: "value",
            call: "value",
          };
      let res = handleProcess(event, {
        ...config,
        depth: 2,
        getParams: () => {
          return params;
        },
        getComponentPackageName: () => {
          return config.getComponentPackageName({ type: "extensionEvent" });
        },
        addParentDependencyImport: isExtensionBus
          ? addExtensionBusDependencyImport
          : addDependencyImport,
        getComponentMeta: ((com, configMeta) => {
          return config.getComponentMeta(com, {
            ...configMeta,
            json: meta,
          });
        }) as typeof config.getComponentMeta,
      } as any);

      const indent = indentation(config.codeStyle!.indent);
      const indent2 = indentation(config.codeStyle!.indent * 2);
      const indent3 = indentation(config.codeStyle!.indent * 3);

      if (isExtensionApi) {
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

        res =
          `${indent}/** ${event.title} */` +
          `\n${indent}${event.title}: MyBricks.Api = transformApi((value: MyBricks.Any) => {` +
          (returnInterface ? `\n${returnInterface}` : "") +
          `\n${res}${returnInterface ? " as Return" : ""}` +
          `\n${indent}})\n`;
      } else if (isExtensionBus) {
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

        extensionBusInitCode +=
          `${indent}/** ${event.title} */` +
          `\n${indent}${event.title}: MyBricks.Api = createFx((value: MyBricks.Any) => {` +
          (returnInterface ? `\n${returnInterface}` : "") +
          `\n${res}${returnInterface ? " as Return" : ""}` +
          `\n${indent}})\n`;
        return;
      }

      result.push({
        content: res,
        importManager,
        meta,
        type: event.type,
        name: event.title,
      });
    });
  });

  if (extensionBusInitCode) {
    result.push({
      content:
        `/** 系统总线 */` + "\nclass Bus {" + `\n${extensionBusInitCode}` + "}",
      importManager: extensionBusImportManager,
      type: "extension-bus",
      name: "系统总线",
    });
  }

  return result;
};

export default handleExtension;

const getExtensionType = (type: Result[0]["type"]) => {
  return {
    isExtensionConfig: type === "extension-config",
    isExtensionApi: type === "extension-api",
    isExtensionBus: type === "extension-bus",
  };
};
