import React from "react";

import Main from "./Main";

export function render(json, opts?: { env?, comDefs?,observable?,ref? } = {}) {
  return (
    <Main json={json} opts={opts as any}/>
  )
}