import type { Def, Scene } from "../types";

/** 判断是模块ui组件 */
export const validateUiModule = (namespace: string) => {
  return namespace === "mybricks.core-comlib.module";
};

/** 判断是弹窗类场景 */
export const validateScenePopup = (scene: Scene) => {
  return scene.type === "popup" || scene.type === "module";
};

/** 判断是输入值获取组件 */
export const validateJsFrameInputComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.frame-input";
};

/** 判断是作用域输出 */
export const validateJsFrameOutputComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.frame-output";
};

/** 判断是场景类型组件 */
export const validateJsScenesComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.scenes";
};

/** 判断是否fx卡片类型组件 */
export const validateJsVarComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.var";
};

/** 判断是否fx卡片类型组件 */
export const validateJsFxComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.fn";
};

/** 判断是否事件类型组件 */
export const validateJsEventComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.ext-event";
};

const BUS_COMPONENT_MAP: Record<string, boolean> = {
  "mybricks.core-comlib.bus-getUser": true,
};

/** 判断是否bus类型组件 */
export const validateJsBusComponent = (namespace: string) => {
  return BUS_COMPONENT_MAP[namespace];
};

/** 判断是否js类型组件 */
export const validateJsComponent = (type?: string) => {
  if (!type) {
    return false;
  }

  return type.match(/^js/);
};

/** 判断是否js多输入 */
export const validateJsMultipleInputs = (input: string) => {
  return input.match(/\./); // input.xxx 为多输入模式
};

export type ComponentTypeAndCategory =
  | {
      componentType: "js";
      category:
        | "normal"
        | "frameInput"
        | "frameOutput"
        | "fx"
        | "scene"
        | "var"
        | "bus"
        | "event";
    }
  | {
      componentType: "ui";
      category: "normal" | "module";
    };

export const getComponentTypeAndCategoryByDef = (
  def: Def,
): ComponentTypeAndCategory => {
  const { rtType, namespace } = def;
  let componentType = "ui";
  let category = "normal";
  const isJsComponent = validateJsComponent(rtType);
  if (isJsComponent) {
    componentType = "js";
    if (validateJsFrameInputComponent(namespace)) {
      category = "frameInput";
    } else if (validateJsFrameOutputComponent(namespace)) {
      category = "frameOutput";
    } else if (validateJsFxComponent(namespace)) {
      category = "fx";
    } else if (validateJsScenesComponent(namespace)) {
      category = "scene";
    } else if (validateJsVarComponent(namespace)) {
      category = "var";
    } else if (validateJsBusComponent(namespace)) {
      category = "bus";
    } else if (validateJsEventComponent(namespace)) {
      category = "event";
    }
  } else {
    componentType = "ui";
    if (validateUiModule(namespace)) {
      category = "module";
    }
  }

  return {
    componentType,
    category,
  } as ComponentTypeAndCategory;
};

interface GetConFromSceneByIdParams {
  scene: Scene;
  conId: string;
}
export const getConFromSceneById = (
  params: GetConFromSceneByIdParams,
): Scene["cons"][string][0] => {
  const { scene, conId } = params;
  const { cons } = scene;
  let reslut;

  Object.entries(cons).find(([, con]) => {
    return con.find((con) => {
      if (con.id === conId) {
        reslut = con;
        return true;
      }
      return false;
    });
  });

  return reslut!;
};

const UUID_SEED =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const uuid = (len = 5) => {
  const maxPos = UUID_SEED.length;
  let rtn = "";
  for (let i = 0; i < len; i++) {
    rtn += UUID_SEED.charAt(Math.floor(Math.random() * maxPos));
  }
  return "u_" + rtn;
};
