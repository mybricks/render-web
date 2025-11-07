/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import toCode from "../toCode";
import type { ToJSON } from "../toCode/types";
import handleSlot from "./handleSlot";
import {
  ImportManager,
  firstCharToLowerCase,
  firstCharToUpperCase,
} from "./utils";
import handleGlobal from "./handleGlobal";
import handleExtension from "./handleExtension";
import ai, { AIConfig } from "./withAI";
import abstractEventTypeDef from "./abstractEventTypeDef";

export interface ToSpaCodeConfig {
  getComponentMeta: (
    com: Extract<UI["children"][0], { type: "com" }>["meta"],
    config?: any,
  ) => {
    importInfo: {
      /** 导入名「a as b」*/
      name: string;
      from: string;
      type: "default" | "named";
    };
    /** 组件名 */
    name: string;
    /**
     * 调用名
     * 例如js、ai-js这类特殊组件，调用方式由外部实现
     */
    callName?: string;
  };
  getComponentPackageName: (props?: any) => string;
  getUtilsPackageName: () => string;
  getPageId?: (id: string) => string;
  getBus?: (namespace: string) => { title: string; name: string };
  getApi?: (namespace: string) => { title: string };
  getFileName?: (id: string) => string | undefined;
  getModuleApi: (type: "event") => {
    dependencyImport: {
      packageName: string;
      dependencyNames: string[];
      importType: "default" | "named";
    };
    componentName: string;
  };
  /**
   * 写入更多详细信息
   * 当运行时打印IO日志时，必须开启
   */
  verbose?: boolean;
  getComponentName?: any;
  getComponentController?: any;
  getProviderName?: any;
  getEventNodeName?: any;

  /** 代码风格 */
  codeStyle?: {
    indent: number;
  };
}

/** 返回结果 */
export type Result = Array<{
  content: string;
  importManager: ImportManager;
  type:
    | "normal"
    | "popup"
    | "module"
    | "global"
    | "extension-config"
    | "extension-api"
    | "extension-bus"
    // 组件抽象事件类型定义
    | "abstractEventTypeDef"
    // TODO: 忽略，类型定义没写完整，到这一步的处理不会存在fx类型
    | "fx"
    // api归类，包含 event、api、config
    | "api"
    // 目前不会有，归类到api，不需要分文件
    | "extension-event";
  meta?: ReturnType<typeof toCode>["scenes"][0]["scene"];
  name: string;
}>;

const toHarmonyCode = (tojson: ToJSON, config: ToSpaCodeConfig): Result => {
  return getCode({ tojson, toCodejson: toCode(tojson) }, config);
};

interface ToHarmonyCodeWithAIConfig extends ToSpaCodeConfig {
  ai: AIConfig;
}

const toHarmonyCodeWithAI = async (
  tojson: ToJSON,
  config: ToHarmonyCodeWithAIConfig,
): Promise<Result> => {
  const toCodejson = toCode(tojson);

  const { fileNames, componentNames } = await ai(
    { tojson, toCodejson },
    config.ai,
  );

  return getCode(
    { tojson, toCodejson },
    {
      ...config,
      getFileName(sceneId) {
        // 场景ID查询，包括模块
        return fileNames.find((fileName: any) => fileName.id === sceneId)!
          .fileName;
      },
      getComponentName(params: any) {
        const { com, slot, scene } = params;
        const componentName = componentNames.find((componentName: any) => {
          return componentName.scene.id === scene.id;
        })!;
        const { ui } = componentName;

        if (slot) {
          const uiComponentNames = ui[`${slot.comId}_${slot.slotId}`];
          const uiComponent = uiComponentNames.find(
            (uiComponentName: any) => uiComponentName.id === slot.comId,
          );
          return uiComponent!.componentName;
        }

        const uiComponentNames = !com.parentComId
          ? ui["root"]
          : ui[`${com.parentComId}_${com.frameId}`];
        const uiComponent = uiComponentNames.find(
          (uiComponentName: any) => uiComponentName.id === com.id,
        );

        return uiComponent!.componentName;
      },
      getComponentController(params: any) {
        const { com, scene } = params;
        const componentName = componentNames.find((componentName: any) => {
          return componentName.scene.id === scene.id;
        })!;
        const { ui } = componentName;
        const uiComponentNames = !com.parentComId
          ? ui["root"]
          : ui[`${com.parentComId}_${com.frameId}`];
        const uiComponent = uiComponentNames.find(
          (uiComponentName: any) => uiComponentName.id === com.id,
        );

        return uiComponent!.componentName + "Controller";
      },
      getProviderName(params: any) {
        const { com, slot, scene } = params;

        if (slot) {
          const componentName = componentNames.find((componentName: any) => {
            return componentName.scene.id === scene.id;
          })!;
          const { ui } = componentName;
          const uiComponentNames = ui[`${slot.comId}_${slot.slotId}`];
          const uiComponent = uiComponentNames.find(
            (uiComponentName: any) => uiComponentName.id === slot.comId,
          );

          return `${uiComponent!.componentName}Provider`;
        }

        if (com?.parentComId) {
          const componentName = componentNames.find((componentName: any) => {
            return componentName.scene.id === scene.id;
          })!;
          const { ui } = componentName;
          const uiComponentNames = ui[`${com.parentComId}_${com.frameId}`];

          const uiComponent = uiComponentNames.find(
            (uiComponentName: any) => uiComponentName.id === com.parentComId,
          );

          return `${uiComponent!.componentName}Provider`;
        } else {
          const providerName = fileNames.find(
            (fileName: any) => fileName.id === scene.id,
          )!.fileName;

          return firstCharToLowerCase(providerName) + "Provider";
        }
      },
      getEventNodeName(params: any) {
        const { com, scene, event, type, connectId } = params;
        const componentName = componentNames
          .find((componentName: any) => {
            return componentName.scene.id === scene.id;
          })!
          .event.find((e: any) => {
            return e.id === event.diagramId;
          });

        if (type === "call") {
          const nodeName = componentName.functionExecution.find((node: any) => {
            return (
              node.id === com.id &&
              (connectId ? connectId === node.connectId : true)
            );
          })!.variableName;

          return nodeName;
        } else {
          const nodeName = componentName.functionDefinition.find(
            (node: any) => {
              return node.id === com.id;
            },
          )!.variableName;

          return nodeName;
        }
      },
    },
  );
};

interface GetCodeParams {
  tojson: ToJSON;
  toCodejson: ReturnType<typeof toCode>;
}
const getCode = (params: GetCodeParams, config: ToSpaCodeConfig): Result => {
  transformConfig(config);

  const result: Result = [];
  const { tojson, toCodejson } = params;
  const { scenes, extensionEvents, globalFxs, globalVars, modules } =
    toCodejson;

  const eventsMap = tojson.frames.reduce((pre, cur) => {
    if (cur.type === "extension-event") {
      pre[cur.id] = cur;
    }
    return pre;
  }, {} as any);
  const sceneMap = tojson.scenes.reduce((pre, cur) => {
    pre[cur.id] = cur;
    return pre;
  }, {} as any);

  const getSceneById = (id: string) => {
    return sceneMap[id];
  };

  const getExtensionEventById = (id: string) => {
    return eventsMap[id];
  };

  result.push(
    ...handleExtension(
      {
        extensionEvents,
        tojson,
      },
      {
        ...config,
        // @ts-ignore
        getExtensionEventById,
        getSceneById,
      },
    ),
  );

  const globalVarTypeDef: any = {};

  Object.entries(tojson.global.comsReg).forEach(([, com]) => {
    if (com.def.namespace !== "mybricks.core-comlib.var") {
      // 非变量，不需要初始化
      return;
    }

    globalVarTypeDef[com.title] = com;
  });

  /** 向下记录组件可调用的fx，id唯一，所以直接key-value即可 */
  const defaultFxsMap = tojson.global.fxFrames
    .filter((fxFrame) => {
      return fxFrame.type === "fx";
    })
    .reduce<Record<string, Provider>>((pre, fxFrame) => {
      pre[fxFrame.id] = {
        name: "global",
        class: "global",
        controllers: new Set(),
        useParams: false,
        useEvents: false,
        coms: new Set(),
        useController: false,
        useData: false,
      };
      return pre;
    }, {});

  result.push(
    handleGlobal(
      {
        tojson,
        globalFxs,
        globalVars,
      },
      {
        ...config,
        // @ts-ignore
        getExtensionEventById,
        getSceneById,
      },
    ),
  );

  const abstractEventTypeDefMap: any = {};

  scenes.forEach(({ scene, ui, event }) => {
    const providerMap: ReturnType<BaseConfig["getProviderMap"]> = {};
    const fileName = config.getFileName?.(ui.meta.slotId);
    const providerName = fileName ? `${fileName}Provider` : "slot_Index";
    const currentProvider: ReturnType<BaseConfig["getCurrentProvider"]> = {
      name: firstCharToLowerCase(providerName),
      class: firstCharToUpperCase(providerName),
      controllers: new Set(),
      useParams: false,
      useEvents: false,
      coms: new Set(),
      useController: false,
      useData: false,
    };

    providerMap[currentProvider.name] = currentProvider;

    /** 类型定义 */
    const typeDef = {
      // 变量
      vars: Object.assign({}, globalVarTypeDef),
      // 输入
      inputs: {},
      // 输出
      outputs: {},
    };

    const fxsMap = Object.assign({}, defaultFxsMap);

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
            return (
              (event.type === "var" && !event.meta.parentComId) ||
              (event.type === "listener" && !event.meta.proxy.parentComId)
            );
          });
        }
        return event.filter((event) => {
          return (
            (event.type === "var" &&
              params.comId === event.meta.parentComId &&
              params.slotId === event.meta.frameId) ||
            (event.type === "listener" &&
              params.comId === event.meta.proxy.parentComId &&
              params.slotId === event.meta.proxy.frameId)
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
      getRootProvider: () => {
        return currentProvider;
      },
      getProviderMap: () => {
        return providerMap;
      },
      getExtensionEventById,
      getSceneById,
      depth: 0,
      getTypeDef: () => {
        return typeDef;
      },
      getFxsMap: () => {
        return fxsMap;
      },
      setAbstractEventTypeDefMap: (params) => {
        const { comId, eventId, typeDef, schema } = params;
        if (!abstractEventTypeDefMap[comId]) {
          abstractEventTypeDefMap[comId] = {
            typeDef,
            eventIdMap: {},
          };
        }
        abstractEventTypeDefMap[comId].eventIdMap[eventId] = schema;
      },
    });
  });

  modules.forEach(({ scene, ui, event }) => {
    const providerMap: ReturnType<BaseConfig["getProviderMap"]> = {};
    const fileName = config.getFileName?.(ui.meta.slotId);
    const providerName = fileName ? `${fileName}Provider` : "slot_Index";
    const currentProvider: ReturnType<BaseConfig["getCurrentProvider"]> = {
      name: firstCharToLowerCase(providerName),
      class: firstCharToUpperCase(providerName),
      controllers: new Set(),
      useParams: false,
      useEvents: false,
      coms: new Set(),
      useController: false,
      useData: false,
    };
    providerMap[currentProvider.name] = currentProvider;

    /** 类型定义 */
    const typeDef = {
      // 变量
      vars: Object.assign({}, globalVarTypeDef),
      // 输入
      inputs: {},
      // 输出
      outputs: {},
    };

    const fxsMap = Object.assign({}, defaultFxsMap);

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
            return (
              (event.type === "var" && !event.meta.parentComId) ||
              (event.type === "listener" && !event.meta.proxy.parentComId)
            );
          });
        }
        return event.filter((event) => {
          return (
            (event.type === "var" &&
              params.comId === event.meta.parentComId &&
              params.slotId === event.meta.frameId) ||
            (event.type === "listener" &&
              params.comId === event.meta.proxy.parentComId &&
              params.slotId === event.meta.proxy.frameId)
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
      getRootProvider() {
        return currentProvider;
      },
      getProviderMap: () => {
        return providerMap;
      },
      getExtensionEventById,
      getSceneById,
      depth: 0,
      getTypeDef() {
        return typeDef;
      },
      getFxsMap: () => {
        return fxsMap;
      },
      setAbstractEventTypeDefMap: (params) => {
        const { comId, eventId, typeDef, schema } = params;
        if (!abstractEventTypeDefMap[comId]) {
          abstractEventTypeDefMap[comId] = {
            typeDef,
            eventIdMap: {},
          };
        }
        abstractEventTypeDefMap[comId].eventIdMap[eventId] = schema;
      },
    });
  });

  result.push({
    type: "abstractEventTypeDef",
    content: abstractEventTypeDef(abstractEventTypeDefMap, config),
    importManager: new ImportManager(config),
    name: "abstractEventTypeDef",
  });

  return result;
};

/** 初始化配置 */
const transformConfig = (config: ToSpaCodeConfig) => {
  if (!config.codeStyle) {
    config.codeStyle = {
      indent: 2,
    };
  }
};

type ToCodeResult = ReturnType<typeof toCode>;
export type UI = ToCodeResult["scenes"][0]["ui"];

interface Provider {
  name: string;
  class: string;
  controllers: Set<string>;
  /** 跨作用域调用当前输入项（当前仅作用于插槽） */
  useParams: boolean;
  /** 调用事件（当前仅区块的输出项） */
  useEvents: boolean;
  coms: Set<string>;
  /** 使用区块的输入项 */
  useController: boolean;
  /** 使用区块的配置项 */
  useData: boolean;
}

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
  getCurrentProvider: () => Provider;
  getRootProvider: () => Provider;
  getProviderMap: () => Record<
    string,
    ReturnType<BaseConfig["getCurrentProvider"]>
  >;
  getExtensionEventById: (
    id: string,
  ) => ReturnType<typeof toCode>["scenes"][0]["event"][0];
  getSceneById: (id: string) => ReturnType<typeof toCode>["scenes"][0]["scene"];
  /** 层级，用于格式化代码 */
  depth: number;
  getTypeDef: () => {
    vars: Record<string, any>;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
  };
  getFxsMap: () => Record<string, Provider>;
  setAbstractEventTypeDefMap: (params: {
    comId: string;
    eventId: string;
    typeDef: any;
    schema: any;
  }) => void;
}

export default toHarmonyCode;

export { toHarmonyCodeWithAI };
