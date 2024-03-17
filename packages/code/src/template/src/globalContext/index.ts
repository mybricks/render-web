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
  inputs: {
    [key: string | symbol]: (value: unknown, outputs?: unknown) => void;
  };
  outputs: {
    [key: string | symbol]: (value?: unknown) => void;
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
  private scenesRefresh: () => void = () => {};
  /** 场景 设置场景刷新state */
  setScenesRefresh(scenesRefresh: (value: SetStateAction<number>) => void) {
    this.scenesRefresh = () => scenesRefresh((prev) => prev + 1);
  }
  /** 场景 映射关系 */
  scenesMap: {
    [key: string]: {
      show: boolean;
      todoList: Array<{ pinId: string; value: unknown }>;
      inputsData: { [key: string]: unknown };
      fromComponentProps: ComponentProps | null;
      componentPropsMap: { [key: string]: ComponentProps };
    };
  } = {
    /** replace scenesMap */
  };
  
  /** 获取当前场景上下文 */
  getScene(sceneId: string) {
    const scene = this.scenesMap[sceneId];
    return {
      get show() {
        return scene.show;
      },
      set show(show: boolean) {
        scene.show = show;
      },
      close: () => {
        if (scene.show) {
          scene.show = false;
          scene.fromComponentProps = null;
          this.scenesRefresh();
        }
      },
      setFromComponentProps(componentProps: ComponentProps) {
        scene.fromComponentProps = componentProps;
      },
      getFromComponentProps() {
        return scene.fromComponentProps;
      },
      setInputData(inputId: string, value: unknown) {
        scene.inputsData[inputId] = value;
      },
      getInputData(inputId: string) {
        return scene.inputsData[inputId];
      },
      getComponent(componentId: string) {
        return scene.componentPropsMap[componentId];
      },
      setComponent(componentId: string, componentProps: ComponentProps) {
        scene.componentPropsMap[componentId] = componentProps;
      },
    };
  }
  /** 打开场景 */
  openScene(sceneId: string) {
    const scene = this.scenesMap[sceneId];
    if (!scene.show) {
      scene.show = true;
      this.scenesRefresh();
    }
  }
  /** 关闭场景 */
  closeScene(sceneId: string) {
    const scene = this.scenesMap[sceneId];
    if (scene.show) {
      scene.show = false;
      this.scenesRefresh();
    }
  }

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
    canvas: {
      open: (sceneId: string) => {
        this.openScene(sceneId);
      },
    },
  };
}

export default new GlobalContext();
