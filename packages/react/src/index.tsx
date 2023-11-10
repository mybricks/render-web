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

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

class Context {
  private opts: any
  constructor(opts: any) {
    this.opts = opts;
    const { debug } = opts;

    if (typeof debug === "function") {
      const { log, onResume } = debug({
        resume: () => {
          this.next();
        },
        ignoreAll: (bool: boolean) => {
          this._ignoreWait = bool
          if (bool) {
            // 忽略调试，全部执行完
            this.next(true)
          }
        }
      })
      this._pendingContext = new DebuggerPanel({ resume: onResume });
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

  private _pendingContext: any = null;

  private _pending = false
  private _ignoreWait = false
  private _waitCount = 0
  // 断点 unshift 入 pop 出
  private _waitBreakpointIds: any = []
  // 下一步
  private _waitIdToResolvesMap: any = {}

  hasBreakpoint(connection: any) {
    return !this._ignoreWait && (this._pending || connection.isBreakpoint)
  }

  wait(connection: any, cb: any) {
    return new Promise((resolve: any) => {
      if (this._ignoreWait) {
        resolve()
      } else {
        const waiting = this._waitBreakpointIds.length > 0

        if (!waiting) {
          cb()
        }

        this._pendingContext.open(this.opts.env.canvasElement)
        this._pending = true;
        if (connection.isBreakpoint) {
          if (waiting) {
            const lastId = this._waitBreakpointIds[0]
            this._waitIdToResolvesMap[lastId].push(cb)
          }
          const id = (this._waitCount ++) + connection.id
          this._waitBreakpointIds.unshift(id)
          this._waitIdToResolvesMap[id] = [resolve]
        } else {
          const id = this._waitBreakpointIds[0]
          this._waitIdToResolvesMap[id].push(resolve)
        }
      }
    })
  }

  next(nextAll = false) {
    if (nextAll) {
      while (this._waitBreakpointIds.length) {
        this.next()
      }
    } else {
      const id = this._waitBreakpointIds.pop()
      const resolves = this._waitIdToResolvesMap[id]
      if (resolves) {
        resolves.forEach((resolve: any) => resolve())
      }
      if (!this._waitBreakpointIds.length) {
        this._pending = false
        this._pendingContext.close()
      }
    }
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
