import React, { useMemo } from "react";

import Main from "./Main";
import pkg from "../package.json";

console.log(`%c ${pkg.name} %c@${pkg.version}`,`color:#FFF;background:#fa6400`,``,``);

export function render(json, opts: { env?, comDefs?,observable?,ref? } = {}) {
  return (
    <Main json={json} opts={opts as any}/>
  )
}
