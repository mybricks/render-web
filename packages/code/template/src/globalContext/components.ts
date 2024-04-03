import type { ReactNode } from "react";

// @ts-ignore
import comlibCore from "@mybricks/comlib-core";

export type ComponentMap = {
  [key: string]: (props: any) => ReactNode;
};

/** 获取原子组件信息 */
export function getComponentMap() {
  const componentMap: ComponentMap = {};

  // TODO: 收集组件信息
  const regAry = (comAray: any) => {
    comAray.forEach((comDef: any) => {
      if (comDef.comAray) {
        regAry(comDef.comAray);
      } else {
        const { namespace, runtime } = comDef;
        componentMap[namespace] = runtime;
      }
    });
  };

  (window as any)["__comlibs_rt_"].forEach((lib: any) => {
    const comAray = lib.comAray;
    if (comAray && Array.isArray(comAray)) {
      regAry(comAray);
    }
  });

  comlibCore.comAray.forEach(({ namespace, runtime }: any) => {
    componentMap[namespace] = runtime;
  });

  return componentMap;
}
