import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
// import handleIndex from "./handleIndex";
// import handleForwardRefModule from "./handleForwardRefModule";
// import { createDependencyImportCollector } from "./utils";

interface ToSpaCodeConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getComponentMetaByNamespace: (namespace: string) => any;
}

/** 返回结果 */
type Result = Array<{ path: string; content: string }>;

const toHarmonyCode = (tojson: ToJSON, config: ToSpaCodeConfig): Result => {
  const result: Result = [];
  const { scenes, modules } = toCode(tojson);

  /** 主入口依赖 */
  // const [indexDependencyImport, addIndexDependencyImport] =
  //   createDependencyImportCollector();

  const scenesModuleRelativePathMap = modules.reduce<Record<string, string>>(
    (pre, cur) => {
      pre[cur.scene.id] = "../../";
      return pre;
    },
    {},
  );
  scenes.forEach(({ scene, ui, event }) => {
    // return;
    // console.log("🚀 场景 ui => ", ui);
    // console.log("🚀 场景 event => ", event);

    const providerMetaMap = {};

    handleSlot(ui, {
      ...config,
      add: (value) => {
        result.push(value);
      },
      getRootPath: () => {
        return "../";
      },
      getPath: () => {
        return `pages/Page_${scene.id}`;
      },
      getEventByDiagramId: (diagramId) => {
        return event.find((event) => event.diagramId === diagramId);
      },
      getVarEvents: (params) => {
        if (!params) {
          return event.filter((event) => {
            return event.type === "var" && !event.meta.parentComId;
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
            params.comId === event.parentComId &&
            params.slotId === event.parentSlotId
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
          "": "", // 空代表当前
          GlobalContext: "../", // 代表全局，场景输入、全局fx、全局变量
        };
      },
      getModuleRelativePathMap: () => {
        return scenesModuleRelativePathMap;
      },
      getCurrentProvider: () => {
        return {
          name: "slot_Index",
          class: "Slot_Index",
        };
      },
      getProviderMetaMap: () => {
        return providerMetaMap;
      },
    });
  });

  // const moduleRelativePathMap = modules.reduce<Record<string, string>>(
  //   (pre, cur) => {
  //     pre[cur.scene.id] = "../";
  //     return pre;
  //   },
  //   {},
  // );
  // modules.forEach(({ scene, ui, event }) => {
  //   // return;
  //   console.log("🚀 模块 ui => ", ui);
  //   console.log("🚀 模块 event => ", event);

  //   handleForwardRefModule(ui, {
  //     ...config,
  //     add: (value) => {
  //       result.push(value);
  //     },
  //     getPath: () => {
  //       return `modules/Module_${scene.id}`;
  //     },
  //     getEventByDiagramId: (diagramId) => {
  //       return event.find((event) => event.diagramId === diagramId);
  //     },
  //     getVarEvents: (params) => {
  //       if (!params) {
  //         return event.filter((event) => {
  //           return event.type === "var" && !event.meta.parentComId;
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
  //           params.comId === event.parentComId &&
  //           params.slotId === event.parentSlotId
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
  //         "": "", // 空代表当前
  //         GlobalContext: "../../", // 代表全局，场景输入、全局fx、全局变量
  //       };
  //     },
  //     getModuleRelativePathMap: () => {
  //       return moduleRelativePathMap;
  //     },
  //   });
  // });

  // result.push({
  //   path: "index.tsx",
  //   content: handleIndex(scenes),
  // });

  result.push({
    path: "pages/lib.d.ts",
    content: `declare namespace MyBricks {
  type EventValue = any

  type SlotParamsInputValues = any;

  interface SlotParams {
    id: string
    inputValues?: SlotParamsInputValues;
  }
}`,
  });

  return result;
};

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];

export interface BaseConfig extends ToSpaCodeConfig {
  /** 添加最终的文件列表 */
  add: (value: { path: string; content: string }) => void;
  /** 获取相对路径 */
  getRootPath: () => string;
  /** 获取当前路径 */
  getPath: () => string;
  /** 获取事件 */
  getEventByDiagramId: (
    diagramId: string,
  ) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  /** 获取事件 - 变量 */
  getVarEvents: (params?: {
    comId?: string;
    slotId?: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"];
  /** 获取事件 - fx */
  getFxEvents: (params?: {
    comId?: string;
    slotId?: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"];
  /** 获取事件 - 生命周期 */
  getEffectEvent: (params?: {
    comId: string;
    slotId: string;
  }) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  getSlotRelativePathMap: () => Record<string, string>;
  getModuleRelativePathMap: () => Record<string, string>;
  getCurrentProvider: () => { name: string; class: string };
  getProviderMetaMap: () => Record<string, { name: string; class: string }>;
}

export default toHarmonyCode;
