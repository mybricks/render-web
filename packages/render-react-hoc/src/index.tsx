import React, { useMemo } from "react";

import { MyBricksRenderContext, MyBricksRenderProviderProps } from "./hooks";
import { hijackReactcreateElement } from "./observable";

import {
  SlotWrapper,
  UiComponentWrapper,
  handleSingleOutput,
  handleMultipleOutputs,
  jsComponentSingleOutputWrapper as jsCSOW,
  jsComponentMultipleOutputsWrapper as jsCMOW,
  jsComponentMultipleInputsWrapper as jsCMIW,
} from "./hoc";

/** 受目前组件内部具体实现影响，需要对React.createElement做劫持，实现data响应式 */
hijackReactcreateElement();

/** 函数都需要通过这里转一到，工程代码中只需要传入一次env */
class MyBricks {
  private globalContext = {};

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
    return jsCSOW(params, this.globalContext);
  }

  jsComponentMultipleOutputsWrapper(params: Parameters<typeof jsCMOW>[0]) {
    return jsCMOW(params, this.globalContext);
  }

  jsComponentMultipleInputsWrapper(params: Parameters<typeof jsCMIW>[0]) {
    return jsCMIW(params, this.globalContext);
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

/** 空 - 占位 */
export const _ = Symbol.for("mybricks.empty");

export {
  SlotWrapper,
  UiComponentWrapper,
  handleSingleOutput,
  handleMultipleOutputs,
};
