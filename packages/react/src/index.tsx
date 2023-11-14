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
import { DebuggerPanel } from "./Debugger"
import { hijackReactcreateElement } from "./observable"

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

class Context {
  private opts: any
  private debuggerPanel: any
  constructor(opts: any) {
    const { env, debug, observable } = opts
    if (!observable) {
      /** 未传入observable，使用内置observable配合对React.createElement的劫持 */
      hijackReactcreateElement({pxToRem: env.pxToRem, pxToVw: env.pxToVw});
    }
    this.opts = opts;

    if (typeof debug === "function") {
      const debuggerPanel = new DebuggerPanel({ env });
      const { log, onResume } = debug({
        resume: () => {
          debuggerPanel.next();
        },
        ignoreAll: (bool: boolean) => {
          debuggerPanel.setIgnoreWait(bool)
          if (bool) {
            // 忽略调试，全部执行完
            debuggerPanel.next(true)
          }
        }
      })
      debuggerPanel.setResume(onResume)
      this.debuggerPanel = debuggerPanel
      opts.debugLogger = log
    }
  }

  private _refsMap: any = {}

  setRefs(id: string, refs: any) {
    this._refsMap[id] = refs
  }

  getRefsMap() {
    return this._refsMap
  }
}

export function render(json, opts: T_RenderOptions = {}) {
  if (!json) {
    return null
  } else {
    if (!opts.env._context) {
      opts.env._context = new Context(opts)
    }
    if (Array.isArray(json.scenes)) {
      return <MultiScene json={json} opts={opts as any}/>
    }
    return (
      <Main json={json} opts={opts as any} root={json.type === 'module' ? false : true}/>
    )
  }
}
