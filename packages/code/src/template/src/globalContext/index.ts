import React from "react";
import * as antd from "antd";

/**
 * TODO: 资源应该是动态传入的，配置到index.ejs中
 */
(window as any).React = React;
(window as any).antd = antd;
import type { SetStateAction } from "react";
import { getComponentDefinition, ComponentDefinitionMap } from "./components";

interface ComponentProps {
  data: object;
  style?: object;
  slots?: object;
  _inputRegs: {
    [key: string | symbol]: (value: unknown, outputs?: unknown) => void;
  };
  [key: string]: unknown;
}

class GlobalContext {
  constructor() {
    this.initComponentDefinitionMap();
  }

  /** 组件 定义 */
  private componentDefinitionMap: ComponentDefinitionMap = {};
  /** 组件 初始化定义 */
  initComponentDefinitionMap() {
    this.componentDefinitionMap = getComponentDefinition();
  }
  /** 组件 获取组件定义 */
  getComponentDefinition({
    namespace,
    version,
  }: {
    namespace: string;
    version: string;
  }) {
    return this.componentDefinitionMap[`${namespace}-${version}`];
  }

  /** 场景 刷新 */
  private scenesRefresh: (value: SetStateAction<number>) => void = () => {};
  /** 场景 设置场景刷新state */
  setScenesRefresh(scenesRefresh: (value: SetStateAction<number>) => void) {
    this.scenesRefresh = scenesRefresh;
  }
  /** 场景 映射关系 */
  scenesMap: {
    [key: string]: {
      show: boolean;
      todo: string[];
      componentPropsMap: { [key: string]: ComponentProps };
    };
  } = {
    /** replace scenesMap */
  };

  /** 
   * env 组件内部使用 
   * 
   * TODO: 这里应该外部配置的
   */
  env = {
    runtime: true,
    i18n(value: unknown) {
      return value;
    },
  };
}

export default new GlobalContext();
