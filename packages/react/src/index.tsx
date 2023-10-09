/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React from "react";

import Main from "./Main";
import pkg from "../package.json";
import MultiScene from "./MultiScene";
import {T_RenderOptions} from "./types";

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);


export function render(json, opts: T_RenderOptions = {}) {
  if (Array.isArray(json.scenes)) {
    return <MultiScene json={json} opts={opts as any}/>
  }
  return (
    <Main json={json} opts={opts as any}/>
  )
}
