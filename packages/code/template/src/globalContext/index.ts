import type { SetStateAction } from "react";
import { getComponentMap, ComponentMap } from "./components";

type ComponentProps = {
  [key: string]: (value?: any) => any;
};

class GlobalContext {
  constructor() {}

  /** 组件 定义 */
  private componentMap: ComponentMap = getComponentMap();

  /** 组件 获取组件定义 */
  getComponent(namespace: string) {
    return this.componentMap[namespace];
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
  };
}

export default new GlobalContext();
