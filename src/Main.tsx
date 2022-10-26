import React, { useMemo, useCallback } from "react";

import {observable as defaultObservable} from "./observable";
import RenderSlot from './RenderSlot'

export default function Main({json, opts}: { json, opts: { env, comDefs, observable, ref } }) {
  const comDefs = useMemo(() => {//所有组件定义
    if (opts.comDefs) {
      return opts.comDefs
    }

    const comLibs = window["__comlibs_rt_"];//运行组件库，在preivew.html中引入

    if (!comLibs || !Array.isArray(comLibs)) {
      throw new Error(`组件库为空，请检查是否通过<script src="组件库地址"></script>加载了组件库运行时.`)
    }

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

  const {slot, script} = json;

  //根据script生成context对象
  const context = useMemo(() => {
    try {
      return eval(script)({
        comDefs,
        env,
        ref: opts.ref
      }, {
        observable: opts.observable || defaultObservable
      })
    } catch (ex) {
      console.error(ex);
      throw new Error(`导出的JSON执行异常，请检查 script 部分的正确性.`)
    }
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

