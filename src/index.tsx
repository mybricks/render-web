
import React from "react";

import Main from "./Main";

export function render({ json, env }) {
  return (
    <Main json={json} env={env}/>
  )
}