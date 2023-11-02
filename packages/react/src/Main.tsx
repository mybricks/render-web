/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, {
  useMemo,
  useCallback,
  useLayoutEffect,
  useEffect,
} from 'react';

import coreLib from '@mybricks/comlib-core';
import { render } from './index'
import executor from '../../core/executor'
import RenderSlot from './RenderSlot';
import {compareVersion, loadCSSLazy} from '../../core/utils';
import {setLoggerSilent} from '../../core/logger';
import Notification from './Notification';
import ErrorBoundary from './ErrorBoundary';
import {observable as defaultObservable, hijackReactcreateElement} from './observable';
import {T_RenderOptions} from "./types";
import RenderSlotLess from './RenderSlot.lazy.less';
import MultiSceneLess from './MultiScene.lazy.less';
import ErrorBoundaryLess from './ErrorBoundary/style.lazy.less';
import NotificationLess from './Notification/style.lazy.less';

/** 遍历组件库，处理成comDefs所需的格式 */
const regAry = (comAray, comDefs) => {
  comAray.forEach(comDef => {
    if (comDef.comAray) {
      regAry(comDef.comAray, comDefs);
    } else {
      comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
    }
  })
}

let count = 1

export default function Main({json, opts, style = {}, className = '', root = true}: { json, opts: T_RenderOptions, style?, className?, root: boolean }) {
  //环境变量，此处可以定义连接器、多语言等实现
  const env = useMemo(() => {
    if (count === 1) {
      count = 2
      const pxToRem = opts.env?.pxToRem

      if (pxToRem) {
        const { enableAdaptive = false, landscapeWidth = 1440 } = pxToRem
        const rootDom = document.documentElement
        if (enableAdaptive) {
          function calculateFontSize() {
            rootDom.style.fontSize = (rootDom.clientWidth / (landscapeWidth / 12)) + 'px'
          }
          calculateFontSize()
          window.addEventListener('resize', calculateFontSize)
        } else {
          rootDom.style.fontSize = '12px';
        }
      } else {
        // rootDom.style.fontSize = '12px';
      }
    }

    if (!!opts?.env?.silent) {
      setLoggerSilent();
    }
    Notification.init(opts?.env?.showErrorNotification);

    const { env } = opts
    if (!env.runtime) {
      env.runtime = {}
    }
    if (!env.i18n) {
      env.i18n = (text) => text
    }
    if (!env.canvas) {
      env.canvas = {
        type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc'
      }
    }
    if (!('canvasElement' in env)) {
      env.canvasElement = opts.debug ? (opts.env?.shadowRoot || document.getElementById('_mybricks-geo-webview_')?.shadowRoot?.getElementById('_geoview-wrapper_') || document.body) : document.body
    }

    if (!opts.env.renderCom) {
      opts.env.renderCom = (json, options) => {
        return render(json, { ...options, env })
      }
    }

    return env

    // return Object.assign({
    //   runtime: {},
    //   i18n(text: any) {
    //     return text
    //   },
    //   canvasElement: opts.debug ? (opts.env?.shadowRoot || document.getElementById('_mybricks-geo-webview_')?.shadowRoot?.getElementById('_geoview-wrapper_') || document.body) : document.body,
    //   canvas: {
    //     type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc'
    //   }
    // }, opts.env)
  }, [])
  
  const comDefs = useMemo(() => {
    if (!opts.observable) {
      /** 未传入observable，使用内置observable配合对React.createElement的劫持 */
      hijackReactcreateElement({pxToRem: env.pxToRem, pxToVw: env.pxToVw});
    }

    let comDefs: null | {[key: string]: any} = null;

    /** 外部传入组件信息 */
    if (opts.comDefs) {
      comDefs = {};
      Object.assign(comDefs, opts.comDefs);
    }

    /** 默认从window上查找组件库 */
    let comLibs = [...(window["__comlibs_edit_"] || []), ...(window["__comlibs_rt_"] || [])];

    if (!comDefs) {
      if (!comLibs.length) {
        /** 没有外部传入切window上没有组件库 */
        throw new Error(`组件库为空，请检查是否通过<script src="组件库地址"></script>加载或通过comDefs传入了组件库运行时.`)
      } else {
        comDefs = {}
      }
    }

    /** 插入核心组件库(fn,var等) */
    comLibs.push(coreLib)
    comLibs.forEach(lib => {
      const comAray = lib.comAray;
      if (comAray && Array.isArray(comAray)) {
        regAry(comAray, comDefs);
      }
    })

    return comDefs;
  }, [])

  const getComDef = useCallback((def) => {
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
  }, [])

  const {slot} = json;

  // onError
  const onError = useMemo(() => {
    const { debug, onError } = opts

    if (debug && typeof onError === 'function') {
      return onError
    }

    return (e) => {
      console.error(e);
      Notification.error(e);
    };
  }, []);
  // logger
  const logger = useMemo(() => {
    return {
      ...console,
      error: (e) => {
        console.error(e);
        Notification.error(e);
      },
    };
  }, []);

  //根据script生成context对象
  const [context, refs, activeTriggerInput] = useMemo(() => {
    loadCSSLazy(RenderSlotLess, env.shadowRoot)
    loadCSSLazy(MultiSceneLess, env.shadowRoot)
    loadCSSLazy(ErrorBoundaryLess, env.shadowRoot)
    loadCSSLazy(NotificationLess, env.shadowRoot)
    try {
      let refs
      let activeTriggerInput = true
      const context = executor({
        json,
        getComDef,
        events: opts.events,
        env,
        ref(_refs) {
          refs = _refs
          if (typeof opts.ref === 'function') {
            opts.ref(_refs)
            // 如果被代理，那么inputs由外部处理
            activeTriggerInput = false
          }
        },
        onError,
        debug: opts.debug,
        debugLogger: opts.debugLogger,
        logger,
        scenesOperate: opts.scenesOperate
      }, {//////TODO goon
        observable: opts.observable || defaultObservable//传递获取响应式的方法
      })

      return [context, refs, activeTriggerInput]
    } catch (ex: any) {
      console.error(ex);
      Notification.error(`导出的JSON.script执行异常: ${ex?.stack || ex?.message || ex?.toString?.()}`);
      throw new Error(`导出的JSON.script执行异常.`)
    }
  }, [])

  useLayoutEffect(() => {
    if (!opts.disableAutoRun) {
      if (activeTriggerInput) {
        const { inputs } = refs
        const jsonInputs = json.inputs
        if (inputs && Array.isArray(jsonInputs)) {
          jsonInputs.forEach((input) => {
            const { id, mockData } = input
            let value = void 0
            if (opts.debug && typeof mockData !== 'undefined') {
              try {
                value = JSON.parse(decodeURIComponent(mockData))
              } catch {
                value = mockData
              }
            }
            inputs[id](value)
          })
        }
      }
      refs.run()
    }
  }, [])

  // TODO:
  useEffect(() => {
    const intervalList = []
    let originalSetInterval
    const handle = opts.debug && setInterval.name !== 'mySetInterval'
    if (handle) {
      originalSetInterval = setInterval;
      setInterval = function mySetInterval(...args) {
        const id = originalSetInterval(...args);
        intervalList.push(id);
        return id
      };
    }
   
    return () => {
      if (handle) {
        setInterval = originalSetInterval
        intervalList.forEach((intervalId) =>
          clearInterval(intervalId)
        )
      }
    }
  }, [])

  if (json.rtType === 'js') {
    return <></>
  }

  return (
    <ErrorBoundary errorTip={`页面渲染错误`}>
      <RenderSlot
        env={env}
        style={style}
        _env={opts._env}
        slot={slot}
        getComDef={getComDef}
        context={context}
        className={className}
        createPortal={opts.createPortal || (() => {})}
        onError={onError}
        logger={logger}
        root={root}
      />
    </ErrorBoundary>
  )
}

