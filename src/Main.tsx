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

export default function Main({json, opts}: { json, opts: { env, comDefs, observable, ref } }) {
  const comDefs = useMemo(() => {//所有组件定义
    const CurrentNodeInfo = window["__rxui__"]?.CurrentNodeInfo;

    if (!(CurrentNodeInfo && "current" in CurrentNodeInfo)) {
      // 非rxui.render渲染
      hijackReactcreateElement();
    }

    if (opts.comDefs) {
      return opts.comDefs
    }

    const comLibs = window["__comlibs_rt_"];//运行组件库，在preivew.html中引入

    if (!comLibs || !Array.isArray(comLibs)) {
      throw new Error(`组件库为空，请检查是否通过<script src="组件库地址"></script>加载了组件库运行时.`)
    }

    comLibs.push(coreLib)

    const comDefs = {}
    const regAry = (comAray) => {
      comAray.forEach(comDef => {
        if (comDef.comAray) {
          regAry(comDef.comAray);
        } else {
          comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
        }
      })
    }

    comLibs.forEach(lib => {
      const comAray = lib.comAray;

      if (comAray && Array.isArray(comAray)) {
        regAry(comAray);
      }
    })

    return comDefs;
  }, [])

  const getComDef = useCallback((def) => {
    return comDefs[`${def.namespace}-${def.version}`];
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
        comDefs,
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

