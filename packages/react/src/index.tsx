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
import { loadCSSLazy } from "../../core/utils"
import RenderSlotLess from './RenderSlot.lazy.less';
import MultiSceneLess from './MultiScene.lazy.less';
import ErrorBoundaryLess from './ErrorBoundary/style.lazy.less';
import NotificationLess from './Notification/style.lazy.less';
import DebuggerLess from './Debugger/style.lazy.less';
import {setLoggerSilent} from '../../core/logger';
import Notification from './Notification';
import {compareVersion} from '../../core/utils';
// @ts-ignore
import coreLib from '@mybricks/comlib-core';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

class Context {
  private opts: any
  private debuggerPanel: any
  
  comDefs: any
  onError: any
  logger: any
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

    this.initOther()
    this.initCss()
    this.initComdefs()
  }

  // 初始化其它信息
  initOther() {
    const { env, debug, onError } = this.opts
    if (!!env.silent) {
      setLoggerSilent();
    }
    Notification.init(env.showErrorNotification);

    if (debug && typeof onError === 'function') {
      return this.onError = onError
    } else {
      this.onError = (e: any) => {
        console.error(e);
        Notification.error(e);
      }
    }

    this.logger = {
      ...console,
      error: (e: any) => {
        console.error(e);
        Notification.error(e);
      },
    }
  }

  // 初始化样式
  initCss() {
    const shadowRoot = this.opts.env.shadowRoot
    loadCSSLazy(RenderSlotLess, shadowRoot)
    loadCSSLazy(MultiSceneLess, shadowRoot)
    loadCSSLazy(ErrorBoundaryLess, shadowRoot)
    loadCSSLazy(NotificationLess, shadowRoot)
    if (typeof this.opts.debug === "function") {
      loadCSSLazy(DebuggerLess, shadowRoot)
    }
  }

  // 初始化组件信息
  initComdefs() {
    const regAry = (comAray: any, comDefs: any) => {
      comAray.forEach((comDef: any) => {
        if (comDef.comAray) {
          regAry(comDef.comAray, comDefs);
        } else {
          comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
        }
      })
    }
    // const 
    let finalComDefs: null | {[key: string]: any} = null;
    const { comDefs } = this.opts;

    /** 外部传入组件信息 */
    if (comDefs) {
      finalComDefs = {};
      Object.assign(finalComDefs, comDefs);
    }

    /** 默认从window上查找组件库 */
    let comLibs = [...((window as any)["__comlibs_edit_"] || []), ...((window as any)["__comlibs_rt_"] || [])];

    if (!finalComDefs) {
      if (!comLibs.length) {
        /** 没有外部传入切window上没有组件库 */
        throw new Error(`组件库为空，请检查是否通过<script src="组件库地址"></script>加载或通过comDefs传入了组件库运行时.`)
      } else {
        finalComDefs = {}
      }
    }

    /** 插入核心组件库(fn,var等) */
    comLibs.push(coreLib)
    comLibs.forEach(lib => {
      const comAray = lib.comAray;
      if (comAray && Array.isArray(comAray)) {
        regAry(comAray, finalComDefs);
      }
    })

    this.comDefs = finalComDefs;
  }

  getComDef(def: { namespace: string, version: string }) {
    const { comDefs } = this
    const rtn = comDefs[def.namespace + '-' + def.version]
    if (!rtn) {
      const ary = []
      for (let ns in comDefs) {
        if (ns.startsWith(def.namespace + '-')) {
          ary.push(comDefs[ns])
        }
      }

      if (ary && ary.length > 0) {
        ary.sort((a, b) => {
          return compareVersion(a.version, b.version)
        })

        const rtn0 = ary[0]
        console.warn(`【Mybricks】组件${def.namespace + '@' + def.version}未找到，使用${rtn0.namespace}@${rtn0.version}代替.`)

        return rtn0
      } else {
        console.log(comDefs)

        throw new Error(`组件${def.namespace + '@' + def.version}未找到，请确定是否存在该组件以及对应的版本号.`)
      }
    }
    return rtn
  }

  // 模块相关
  private _refsMap: any = {}

  setRefs(id: string, refs: any) {
    this._refsMap[id] = refs
  }

  getRefsMap() {
    return this._refsMap
  }
}

export function render(json: any, opts: T_RenderOptions = {}) {
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
