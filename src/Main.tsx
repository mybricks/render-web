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

// import coreLib from '@mybricks/comlib-core';

import executor from './executor';
import RenderSlot from './RenderSlot';
import {compareVersion} from './utils';
import {setLoggerSilent} from './logger';
import ErrorBoundary from './ErrorBoundary';
import {observable as defaultObservable} from './observable';

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

export default function Main({json, opts}: { json, opts: { env, events, comDefs, comInstance, observable, ref } }) {
  
  const comInstance = useMemo(() => {
    return opts.comInstance || {}
  }, []);
  
  const comDefs = useMemo(() => {
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
    // comLibs.push(coreLib)
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

  //环境变量，此处可以定义连接器、多语言等实现
  const env = useMemo(() => {
    if (!!opts?.env?.silent) {
      setLoggerSilent();
    }
    return Object.assign({
      runtime: {},
      i18n(text: any) {
        return text
      },
      canvasElement: document.body
    }, opts.env)
  }, [])

  const {slot} = json;

  // onError
  const onError = useMemo(() => {
    return (e) => {
      console.error(e);
    };
  }, []);
  // logger
  const logger = useMemo(() => {
    return {
      ...console,
      error: (e) => {
        console.error(e);
      },
    };
  }, []);

  //根据script生成context对象
  const [context, refs] = useMemo(() => {
    try {
      let refs
      const context = executor({
        json,
        comInstance,
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
        logger
      }, {//////TODO goon
        observable: opts.observable || defaultObservable
      })

      return [context, refs]
    } catch (ex: any) {
      console.error(ex);
      throw new Error(`导出的JSON.script执行异常.`)
    }
  }, [])

  useLayoutEffect(() => {
    refs.run()
  }, [])

  return (
    <ErrorBoundary errorTip={`页面渲染错误`}>
      <RenderSlot
        env={env}
        slot={slot}
        getComDef={getComDef}
        getContext={context.get}
        __rxui_child__={!opts.observable}
        onError={onError}
        logger={logger}
      />
    </ErrorBoundary>
  )
}

