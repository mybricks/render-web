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
  useLayoutEffect
} from 'react';

import coreLib from '@mybricks/comlib-core';

import executor from './executor';
import RenderSlot from './RenderSlot';
import {compareVersion, loadCSSLazy} from './utils';
import {setLoggerSilent} from './logger';
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

export default function Main({json, opts, style = {}, className = ''}: { json, opts: T_RenderOptions, style?, className? }) {
  //环境变量，此处可以定义连接器、多语言等实现
  const env = useMemo(() => {
    if (count === 1) {
      count = 2
      const pxToRem = opts.env?.pxToRem
      const rootDom = document.documentElement

      if (pxToRem) {
        const { enableAdaptive = false, landscapeWidth = 1440 } = pxToRem
        if (enableAdaptive) {
          function calculateFontSize() {
            rootDom.style.fontSize = (rootDom.clientWidth / (landscapeWidth / 12)) + 'px'
          }
          calculateFontSize()
          window.addEventListener('resize', calculateFontSize)
        }
      } else {
        rootDom.style.fontSize = '12px';
      }
    }

    if (!!opts?.env?.silent) {
      setLoggerSilent();
    }
    Notification.init(opts?.env?.showErrorNotification);
    return Object.assign({
      runtime: {},
      i18n(text: any) {
        return text
      },
      canvasElement: document.body,
      canvas: {
        type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc'
      }
    }, opts.env)
  }, [])
  
  const comDefs = useMemo(() => {
    if (!opts.observable) {
      /** 未传入observable，使用内置observable配合对React.createElement的劫持 */
      hijackReactcreateElement({pxToRem: env.pxToRem});
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
  const [context, refs] = useMemo(() => {
    loadCSSLazy(RenderSlotLess, env.shadowRoot)
    loadCSSLazy(MultiSceneLess, env.shadowRoot)
    loadCSSLazy(ErrorBoundaryLess, env.shadowRoot)
    loadCSSLazy(NotificationLess, env.shadowRoot)
    try {
      let refs
      const context = executor({
        json,
        getComDef,
        events: opts.events,
        env,
        ref(_refs) {
          refs = _refs
          if (opts.ref) {
            opts.ref(_refs)
          }
        },
        onError,
        debugLogger: opts.debugLogger,
        logger,
        scenesOperate: opts.scenesOperate
      }, {//////TODO goon
        observable: opts.observable || defaultObservable//传递获取响应式的方法
      })

      return [context, refs]
    } catch (ex: any) {
      console.error(ex);
      Notification.error(`导出的JSON.script执行异常: ${ex?.stack || ex?.message || ex?.toString?.()}`);
      throw new Error(`导出的JSON.script执行异常.`)
    }
  }, [])

  useLayoutEffect(() => {
    if (!opts.disableAutoRun) {
      refs.run()
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
        getContext={context.get}
        className={className}
        __rxui_child__={!opts.observable}
        onError={onError}
        logger={logger}
        root={true}
      />
    </ErrorBoundary>
  )
}

