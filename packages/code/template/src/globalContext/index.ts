import { getComponentMap, ComponentMap } from "./components";

class GlobalContext {
  constructor() {}

  /** 组件 定义 */
  componentMap: ComponentMap = getComponentMap();

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
