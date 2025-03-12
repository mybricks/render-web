import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import handleIndex from "./handleIndex";
import { createDependencyImportCollector } from "./utils";

interface ToSpaCodeConfig {
  getDefaultDataByNamespace: (namespace: string) => Record<string, object>;
  getComponentNameByNamespace: (namespace: string) => string;
  getComponentDependencyImportByNamespace: (
    namespace: string,
  ) => Parameters<ReturnType<typeof createDependencyImportCollector>[1]>[0];
}

/** 返回结果 */
type Result = Array<{ path: string; content: string }>;

const toSpaCode = (tojson: ToJSON, config: ToSpaCodeConfig): Result => {
  const result: Result = [];
  const { scenes } = toCode(tojson);

  /** 主入口依赖 */
  // const [indexDependencyImport, addIndexDependencyImport] =
  //   createDependencyImportCollector();

  scenes.forEach(({ scene, ui, event }) => {
    console.log("🚀 ui => ", ui);
    console.log("🚀 event => ", event);

    handleSlot(ui, {
      ...config,
      add: (value) => {
        result.push(value);
      },
      getPath: () => {
        return `scenes/Scene_${scene.id}`;
      },
      getEventByDiagramId: (diagramId) => {
        return event.find((event) => event.diagramId === diagramId);
      },
      getEventByComIdAndSlotId: ({ slotId }) => {
        console.log("[TODO] ❌ 做到作用域插槽的时候看一下");
        return event.find((event) => event.slotId === (slotId || scene.id));
      },
      getVarEvents: (params) => {
        if (!params) {
          return event.filter((event) => {
            return event.type === "var" && !event.parentComId;
          });
        }
        return event.filter((event) => {
          return (
            event.type === "var" &&
            params.comId === event.meta.parentComId &&
            params.slotId === event.meta.frameId
          );
        });
      },
      getFxEvents: (params) => {
        if (!params) {
          return event.filter((event) => {
            return event.type === "fx" && !event.parentComId;
          });
        }
        return event.filter((event) => {
          return (
            event.type === "fx" &&
            params.comId === event.meta.parentComId &&
            params.slotId === event.meta.frameId
          );
        });
      },
      checkIsRoot: () => true,
      getEffectEvent: (params) => {
        // 默认只有一个生命周期事件
        if (!params) {
          // 主场景
          return event.find((event) => {
            return !event.slotId; // 没有slotId，认为是主场景
          });
        } else {
          // 作用域插槽
          const { comId, slotId } = params;
          return event.find((event) => {
            return event.slotId === slotId && event.comId === comId;
          });
        }
      },
      getSlotRelativePathMap: () => {
        return {
          "": "",
        };
      },
    });
  });

  // modules.forEach(({ scene, ui, event }) => {
  //   console.log("🚀 模块 ui => ", ui);
  //   console.log("🚀 模块 event => ", event);

  //   handleSlot(ui, {
  //     ...config,
  //     add: (value) => {
  //       result.push(value);
  //     },
  //     getPath: () => {
  //       return `scenes/Scene_${scene.id}`;
  //     },
  //     getEventByDiagramId: (diagramId) => {
  //       return event.find((event) => event.diagramId === diagramId);
  //     },
  //     getEventByComIdAndSlotId: ({ slotId }) => {
  //       console.log("[TODO] ❌ 做到作用域插槽的时候看一下");
  //       return event.find((event) => event.slotId === (slotId || scene.id));
  //     },
  //     getVarEvents: (params) => {
  //       if (!params) {
  //         return event.filter((event) => {
  //           return event.type === "var" && !event.parentComId;
  //         });
  //       }
  //       return event.filter((event) => {
  //         return (
  //           event.type === "var" &&
  //           params.comId === event.meta.parentComId &&
  //           params.slotId === event.meta.frameId
  //         );
  //       });
  //     },
  //     getFxEvents: (params) => {
  //       if (!params) {
  //         return event.filter((event) => {
  //           return event.type === "fx" && !event.parentComId;
  //         });
  //       }
  //       return event.filter((event) => {
  //         return (
  //           event.type === "fx" &&
  //           params.comId === event.meta.parentComId &&
  //           params.slotId === event.meta.frameId
  //         );
  //       });
  //     },
  //     checkIsRoot: () => true,
  //     getEffectEvent: (params) => {
  //       // 默认只有一个生命周期事件
  //       if (!params) {
  //         // 主场景
  //         return event.find((event) => {
  //           return !event.slotId; // 没有slotId，认为是主场景
  //         });
  //       } else {
  //         // 作用域插槽
  //         const { comId, slotId } = params;
  //         return event.find((event) => {
  //           return event.slotId === slotId && event.comId === comId;
  //         });
  //       }
  //     },
  //     getSlotRelativePathMap: () => {
  //       return {
  //         "": "",
  //       };
  //     },
  //   });
  // });

  result.push({
    path: "scenes/index.tsx",
    content: handleIndex(scenes),
  });

  return result;
};

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];

export interface BaseConfig extends ToSpaCodeConfig {
  /** 添加最终的文件列表 */
  add: (value: { path: string; content: string }) => void;
  /** 获取当前路径 */
  getPath: () => string;
  /** 获取事件 */
  getEventByDiagramId: (
    diagramId: string,
  ) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  /** 获取事件 - 插槽 */
  getEventByComIdAndSlotId: (params: {
    comId: string;
    slotId: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  /** 获取事件 - 变量 */
  getVarEvents: (params?: {
    comId: string;
    slotId: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"];
  /** 获取事件 - fx */
  getFxEvents: (params?: {
    comId: string;
    slotId: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"];
  /** 获取事件 - 生命周期 */
  getEffectEvent: (params?: {
    comId: string;
    slotId: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  getSlotRelativePathMap: () => Record<string, string>;
}

export { toSpaCode };
