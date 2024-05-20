import React, { useMemo } from "react";

import type { ReactNode } from "react";

import { MyBricksRenderContext, MyBricksRenderProviderProps, SceneProvider } from "./hooks";
import { hijackReactcreateElement } from "./observable";

import {
  fxWrapper,
  SlotWrapper,
  variableWrapper,
  UiComponentWrapper,
  handleSingleOutput,
  handleMultipleOutputs,
  sceneContextWrapper as sCW,
  jsComponentSingleOutputWrapper as jsCSOW,
  jsComponentMultipleOutputsWrapper as jsCMOW,
  jsComponentMultipleInputsWrapper as jsCMIW,
} from "./hoc";

/** 受目前组件内部具体实现影响，需要对React.createElement做劫持，实现data响应式 */
hijackReactcreateElement();

export interface GlobalContext {
  /** 环境参数 - 注入组件 */
  env: any;
  /** 组件定义 - namespace => React组件 */
  componentMap: { [key: string]: React.FC<any>; }
}

interface Scene {
  /** 是否展示 - 未来应该只有popup才有这个，page直接使用react-router */
  show: boolean;
  /** 组件可调用inputs信息 */
  componentPropsMap: any;
  /** 开启场景 */
  open: () => void;
  /** 关闭场景 */
  close: () => void;
}

export interface MyBricksGlobalContext extends GlobalContext {
  scenesMap: {
    /** 场景ID */
    [key: string]: Scene;
  }
  /** 获取组件定义 */
  getComponent: (namespace: string) => React.FC<any>;
  /** 获取场景信息 */
  getScene: (sceneId: string) => Scene;
}

/** 函数都需要通过这里转一到，工程代码中只需要传入一次env */
export class MyBricks {
  // @ts-ignore
  globalContext: MyBricksGlobalContext = {
    scenesMap: {},
    getComponent: (namespace) => {
      return this.globalContext.componentMap[namespace];
    },
    getScene: (sceneId) => {
      return this.globalContext.scenesMap[sceneId];
    },
  };

  get MyBricksRenderProvider() {
    return ({ children, value }: { children: ReactNode, value: GlobalContext}) => {
      const { globalContext } = this;
      useMemo(() => {
        const { env, componentMap } = value;
        globalContext.env = env;
        globalContext.componentMap = componentMap;
      }, []);
      return (
        <MyBricksRenderContext.Provider value={globalContext}>
          {children}
        </MyBricksRenderContext.Provider>
      );
    };
  }

  jsComponentSingleOutputWrapper(params: Parameters<typeof jsCSOW>[0]) {
    return jsCSOW.bind(this)(params);
  }

  jsComponentMultipleOutputsWrapper(params: Parameters<typeof jsCMOW>[0]) {
    return jsCMOW.bind(this)(params);
  }

  jsComponentMultipleInputsWrapper(params: Parameters<typeof jsCMIW>[0]) {
    return jsCMIW.bind(this)(params);
  }

  sceneContextWrapper(sceneId: Parameters<typeof sCW>[0]) {
    return sCW.bind(this)(sceneId);
  }
}

const mybricks = new MyBricks();

export const MyBricksRenderProvider = mybricks.MyBricksRenderProvider;
export const jsComponentSingleOutputWrapper =
  mybricks.jsComponentSingleOutputWrapper.bind(mybricks);
export const jsComponentMultipleOutputsWrapper =
  mybricks.jsComponentMultipleOutputsWrapper.bind(mybricks);
export const jsComponentMultipleInputsWrapper =
  mybricks.jsComponentMultipleInputsWrapper.bind(mybricks);
export const sceneContextWrapper = mybricks.sceneContextWrapper.bind(mybricks);

/** 空 - 占位 */
export const _ = Symbol.for("mybricks.empty");

export {
  fxWrapper,
  SlotWrapper,
  variableWrapper,
  UiComponentWrapper,
  handleSingleOutput,
  handleMultipleOutputs,
  SceneProvider
};
