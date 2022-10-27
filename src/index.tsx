import React, { useMemo } from "react";

import Main from "./Main";
import pkg from "../package.json";
import { hijackReactcreateElement } from "./observable";

console.log(`%c ${pkg.name} %c@${pkg.version}`,`color:#FFF;background:#fa6400`,``,``);

export function render(json, opts: { env?, comDefs?,observable?,ref? } = {}) {
  useMemo(() => {
    const CurrentNodeInfo = window["__rxui__"]?.CurrentNodeInfo;

    if (!(CurrentNodeInfo && "current" in CurrentNodeInfo)) {
      // 非rxui.render渲染
      hijackReactcreateElement();
    }
  }, [])

  return (
    <Main json={json} opts={opts as any}/>
  );
}
