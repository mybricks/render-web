import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import { ImportManager } from "./utils";
import { handleProcess } from "./handleCom";

interface ToSpaCodeConfig {
  getComponentMetaByNamespace: (
    namespace: string,
    config: {
      type: "js" | "ui";
    },
  ) => {
    dependencyImport: {
      packageName: string;
      dependencyNames: string[];
      importType: "default" | "named";
    };
    componentName: string;
  };
  getComponentPackageName: () => string;
}

/** 返回结果 */
type Result = Array<{
  path: string;
  content: string;
  importManager: ImportManager;
  type: "normal" | "popup" | "module" | "ignore" | "extensionEvent";
  meta?: ReturnType<typeof toCode>["scenes"][0]["scene"];
}>;

const toHarmonyCode = (tojson: ToJSON, config: ToSpaCodeConfig): Result => {
  const result: Result = [];
  const { scenes, extensionEvents } = toCode(tojson);

  const importManager = new ImportManager();
  const addDependencyImport = importManager.addImport.bind(importManager);

  extensionEvents.forEach((event) => {
    const res = handleProcess(event, {
      getParams: () => {
        return {
          open: "value",
        };
      },
      getComponentPackageName: () => {
        return "./_proxy/Index";
      },
      addParentDependencyImport: addDependencyImport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    result.push({
      path: "",
      content: res,
      importManager,
      type: "extensionEvent",
    });
  });

  scenes.forEach(({ scene, ui, event }) => {
    const providerMetaMap = {};
    const usedControllers = new Set<string>();

    handleSlot(ui, {
      ...config,
      getUsedControllers: () => {
        return usedControllers;
      },
      getCurrentScene: () => {
        return scene;
      },
      add: (value) => {
        result.push({
          ...value,
          type: scene.type ? scene.type : "normal",
          meta: scene,
        });
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
        return {};
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

  //   result.push({
  //     path: "lib.d.ts",
  //     importManager: new ImportManager(),
  //     content: `declare namespace MyBricks {
  //   type Any = any

  //   /** 组件数据源 */
  //   type Data = Record<string, Any>

  //   /** 事件参数 */
  //   type EventValue = Any

  //   /** 事件 */
  //   type Events = Any

  //   /** 组件控制器 */
  //   type Controller = Record<string, Any>

  //   /** 调用插槽传参 */
  //   interface SlotParams {
  //     id: string
  //     inputValues?: Any
  //     style?: Any
  //   }

  //   /** 插槽传参 */
  //   type SlotParamsInputValues = Record<string, Any>

  //   /** 内置JS计算组件相关定义 */
  //   interface JSParams {
  //     data: Data
  //     inputs: string[]
  //     outputs: string[]
  //   }

  //   type JSReturn = (...values: MyBricks.EventValue[]) => Record<string, MyBricks.EventValue>

  //   interface CodeParams extends JSParams {
  //     data: {
  //       runImmediate: boolean
  //     }
  //   }

  //   type Codes = Record<string, (params: CodeParams) => (...values: MyBricks.EventValue[]) => Record<string, MyBricks.EventValue>>

  //   /** _env */
  //   type _Env = {
  //     currentScenes: {
  //       close: () => void
  //     }
  //   }
  // }
  // `,
  //     type: "ignore",
  //   });

  return result;
};

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];

export interface BaseConfig extends ToSpaCodeConfig {
  /** 获取当前场景信息 */
  getCurrentScene: () => ReturnType<typeof toCode>["scenes"][0]["scene"];
  /** 获取使用的组件控制器 */
  getUsedControllers: () => Set<string>;
  /** 添加最终的文件列表 */
  add: (value: {
    path: string;
    content: string;
    importManager: ImportManager;
  }) => void;
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
