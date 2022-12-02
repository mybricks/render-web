/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, {useMemo, useCallback, useLayoutEffect} from "react";

import RenderSlot from "./RenderSlot";
import {observable as defaultObservable, hijackReactcreateElement} from "./observable";

import coreLib from '@mybricks/comlib-core'

import executor from './executor'
import {compareVersion} from "./utils";

const regAry = (comAray, comDefs) => {
  comAray.forEach(comDef => {
    if (comDef.comAray) {
      regAry(comDef.comAray, comDefs);
    } else {
      comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
    }
  })
}

export default function Main({json, opts}: { json, opts: { env, events, comDefs, observable, ref } }) {
  const comDefs = useMemo(() => {//所有组件定义
    if (!opts.observable) {
      // 未传入observable，使用内置observable配合对React.createElement的劫持
      hijackReactcreateElement();
    }

    if (opts.comDefs) {
      regAry(coreLib.comAray, opts.comDefs);
      return opts.comDefs
    }

    let comLibs = window["__comlibs_rt_"];//运行组件库，在preivew.html中引入

    if(!comLibs){
      comLibs = window["__comlibs_edit_"]//设计状态
    }

    if (!comLibs || !Array.isArray(comLibs)) {
      throw new Error(`组件库为空，请检查是否通过<script src="组件库地址"></script>加载了组件库运行时.`)
    }

    const comDefs = {}
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

  //环境变量，此处可以定义连接器、多语言等实现
  const env = Object.assign({
    runtime: {},
    i18n(text: any) {
      return text
    }
  }, opts.env)

  const {slot} = json;

  //根据script生成context对象
  const [context, refs] = useMemo(() => {
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
        }
      }, {
        observable: opts.observable || defaultObservable
      })

      return [context, refs]
    } catch (ex) {
      console.error(ex);
      throw new Error(`导出的JSON.script执行异常.`)
    }
  }, [])

  useLayoutEffect(() => {
    refs.run()
  }, [])

  return (
    <RenderSlot
      env={env}
      slot={slot}
      getComDef={getComDef}
      getContext={context.get}
    />
  )
}

