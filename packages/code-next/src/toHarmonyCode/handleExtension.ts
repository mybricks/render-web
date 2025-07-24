/**
 * 处理Extension事件卡片
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import { ImportManager } from "./utils";
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
  const importManager = new ImportManager();
  const addDependencyImport = importManager.addImport.bind(importManager);

  const extensionBusImportManager = new ImportManager();
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
        getParams: () => {
          return params;
        },
        getComponentPackageName: () => {
          return config.getComponentPackageName({ type: "extensionEvent" });
        },
        addParentDependencyImport: isExtensionBus
          ? addExtensionBusDependencyImport
          : addDependencyImport,
        getComponentMetaByNamespace: ((namespace, options) => {
          return config.getComponentMetaByNamespace(namespace, {
            ...options,
            source: "extensionEvent",
          });
        }) as typeof config.getComponentMetaByNamespace,
      } as any);

      if (isExtensionApi) {
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

        res = `/** ${event.title} */
        ${event.title}: MyBricks.Api = transformApi((value: MyBricks.Any) => {
          ${returnInterface}
          ${res} ${returnInterface ? "as Return" : ""}
        })
        `;
      } else if (isExtensionBus) {
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
        extensionBusInitCode += `/** ${event.title} */
        ${event.title}: MyBricks.Any = createFx((value: MyBricks.Any) => {
          ${returnInterface}
          ${res} ${returnInterface ? "as Return" : ""}
        })
        `;
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
      content: `/** 系统总线 */      
      class Bus {
        ${extensionBusInitCode}
      }

      export const bus = new Bus()`,
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
