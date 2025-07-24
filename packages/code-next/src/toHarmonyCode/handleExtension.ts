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
  extensionEvents.forEach((extension) => {
    const { meta, events } = extension;
    events.forEach((event) => {
      const isExtensionConfig = event.type === "extension-config";
      const params = isExtensionConfig
        ? event.paramPins.reduce<Record<string, string>>((pre, cur) => {
            pre[cur.id] = `value.${cur.id}`;
            return pre;
          }, {})
        : { open: "value" };
      let res = handleProcess(event, {
        ...config,
        getParams: () => {
          return params;
        },
        getComponentPackageName: () => {
          return config.getComponentPackageName({ type: "extensionEvent" });
        },
        addParentDependencyImport: addDependencyImport,
        getComponentMetaByNamespace: ((namespace, options) => {
          return config.getComponentMetaByNamespace(namespace, {
            ...options,
            source: "extensionEvent",
          });
        }) as typeof config.getComponentMetaByNamespace,
      } as any);

      if (!isExtensionConfig) {
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
      }

      console.log("[res]", res);

      result.push({
        content: res,
        importManager,
        meta,
        type: event.type,
        name: event.title,
      });
    });
  });

  return result;
};

export default handleExtension;
