import React, { useMemo } from "react";

import Main from "./Main";
import pkg from '../package.json'
import * as rxui from "@mybricks/rxui";
import { hijackReactcreateElement } from "./observable";

let RXUI;

console.log(`%c ${pkg.name} %c@${pkg.version}`,`color:#FFF;background:#fa6400`,``,``);

export function render(json, opts: { env?, comDefs?,observable?,ref? } = {}) {
  useMemo(() => {
    if ("current" in window["__rxui__"]?.CurrentNodeInfo) {
      if (!RXUI) {
        RXUI = rxui;
      }
    } else {
      hijackReactcreateElement();
    }
  }, [])

  return (
    <Main json={json} opts={{...opts, observable: opts.observable || RXUI?.observable} as any}/>
  );
}
