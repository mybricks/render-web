import React, { useMemo } from "react";

import { MyBricksRenderContext, MyBricksRenderProviderProps, SceneProvider } from "./hooks";
import { hijackReactcreateElement } from "./observable";

import {
  fxWrapper,
  SlotWrapper,
  variableWrapper,
  UiComponentWrapper,
  handleSingleOutput,
  handleMultipleOutputs,
  sceneStateWrapper as sSW,
  jsComponentSingleOutputWrapper as jsCSOW,
  jsComponentMultipleOutputsWrapper as jsCMOW,
  jsComponentMultipleInputsWrapper as jsCMIW,
} from "./hoc";

/** 受目前组件内部具体实现影响，需要对React.createElement做劫持，实现data响应式 */
hijackReactcreateElement();

export interface GlobalContext {
  /** 环境参数 - 注入组件 */
  env: any;
  /** 获取组件定义 */
  getComponent: (namespace: string) => any;
  /** 关闭场景 */
  closeScene: (sceneId: string) => void;
}

/** 函数都需要通过这里转一到，工程代码中只需要传入一次env */
export class MyBricks {
  // @ts-ignore
  globalContext: GlobalContext = {};

  get MyBricksRenderProvider() {
    return ({ children, value }: MyBricksRenderProviderProps) => {
      useMemo(() => {
        this.globalContext = value;
      }, []);
      return (
        <MyBricksRenderContext.Provider value={value}>
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

  sceneStateWrapper(sceneId: Parameters<typeof sSW>[0]) {
    return sSW.bind(this)(sceneId);
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
export const sceneStateWrapper = mybricks.sceneStateWrapper.bind(mybricks);

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
