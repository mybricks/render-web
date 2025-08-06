/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import { ImportManager } from "./utils";
import handleGlobal from "./handleGlobal";
import handleExtension from "./handleExtension";

export interface ToSpaCodeConfig {
  getComponentMetaByNamespace: (
    namespace: string,
    config: {
      type: "js" | "ui";
      // [TODO] 来源，extension 或 page
      source?: string;
    },
  ) => {
    dependencyImport: {
      packageName: string;
      dependencyNames: string[];
      importType: "default" | "named";
    };
    componentName: string;
  };
  getComponentPackageName: (props?: any) => string;
  getUtilsPackageName: () => string;
  getPageId?: (id: string) => string;
  getBus?: (namespace: string) => { title: string; name: string };
  getApi?: (namespace: string) => { title: string };
  getFileName?: (id: string) => string | undefined;
  /**
   * 写入更多详细信息
   * 当运行时打印IO日志时，必须开启
   */
  verbose?: boolean;
}

/** 返回结果 */
export type Result = Array<{
  content: string;
  importManager: ImportManager;
  type:
    | "normal"
    | "popup"
    | "module"
    | "extensionEvent"
    | "global"
    | "extension-config"
    | "extension-api"
    | "extension-bus";
  meta?: ReturnType<typeof toCode>["scenes"][0]["scene"];
  name: string;
}>;

const toHarmonyCode = (tojson: ToJSON, config: ToSpaCodeConfig): Result => {
  const result: Result = [];
  const { scenes, extensionEvents, globalFxs, globalVars, modules } =
    toCode(tojson);

  result.push(
    ...handleExtension(
      {
        extensionEvents,
      },
      config,
    ),
  );

  result.push(
    handleGlobal(
      {
        tojson,
        globalFxs,
        globalVars,
      },
      config,
    ),
  );

  scenes.forEach(({ scene, ui, event }) => {
    const providerMap: ReturnType<BaseConfig["getProviderMap"]> = {};
    const currentProvider: ReturnType<BaseConfig["getCurrentProvider"]> = {
      name: "slot_Index",
      class: "Slot_Index",
      controllers: new Set(),
      useParams: false,
      useEvents: false,
      coms: new Set(),
    };
    providerMap[currentProvider.name] = currentProvider;

    handleSlot(ui, {
      ...config,
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
      getEventByDiagramId: (diagramId) => {
        return event.find((event) => event.diagramId === diagramId)!;
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
          })!;
        } else {
          // 作用域插槽
          const { comId, slotId } = params;
          return event.find((event) => {
            return event.slotId === slotId && event.comId === comId;
          })!;
        }
      },
      getCurrentProvider: () => {
        return currentProvider;
      },
      getProviderMap: () => {
        return providerMap;
      },
    });
  });

  modules.forEach(({ scene, ui, event }) => {
    const providerMap: ReturnType<BaseConfig["getProviderMap"]> = {};
    const currentProvider: ReturnType<BaseConfig["getCurrentProvider"]> = {
      name: "slot_Index",
      class: "Slot_Index",
      controllers: new Set(),
      useParams: false,
      useEvents: false,
      coms: new Set(),
    };
    providerMap[currentProvider.name] = currentProvider;

    handleSlot(ui, {
      ...config,
      getCurrentScene: () => {
        return scene;
      },
      add: (value) => {
        result.push({
          ...value,
          type: scene.type,
          meta: scene,
        });
      },
      getEventByDiagramId: (diagramId) => {
        return event.find((event) => event.diagramId === diagramId)!;
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
          })!;
        } else {
          // 作用域插槽
          const { comId, slotId } = params;
          return event.find((event) => {
            return event.slotId === slotId && event.comId === comId;
          })!;
        }
      },
      getCurrentProvider: () => {
        return currentProvider;
      },
      getProviderMap: () => {
        return providerMap;
      },
    });
  });

  return result;
};

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];

export interface BaseConfig extends ToSpaCodeConfig {
  /** 获取当前场景信息 */
  getCurrentScene: () => ReturnType<typeof toCode>["scenes"][0]["scene"];
  /** 添加最终的文件列表 */
  add: (value: {
    content: string;
    importManager: ImportManager;
    name: string;
  }) => void;
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
  getCurrentProvider: () => {
    name: string;
    class: string;
    controllers: Set<string>;
    /** 夸作用域调用当前输入项（当前仅作用域插槽） */
    useParams: boolean;
    /** 调用事件（当前仅区块的输出项） */
    useEvents: boolean;
    coms: Set<string>;
  };
  getProviderMap: () => Record<
    string,
    ReturnType<BaseConfig["getCurrentProvider"]>
  >;
}

export default toHarmonyCode;
