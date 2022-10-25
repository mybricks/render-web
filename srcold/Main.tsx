import {useCallback, useMemo} from "react";
import {observable} from '@mybricks/rxui'

export default function Main({json, env: defEnv}) {
  //运行组件库，在preivew.html中引入
  const comLibs = window['__comlibs_rt_']

  //所有组件定义
  const comDefs = useMemo(() => {
    const comDefs = {}
    const regAry = (comAray) => {
      comAray.forEach(comDef => {
        if (comDef.comAray) {
          regAry(comDef.comAray)
        } else {
          comDefs[`${comDef.namespace}-${comDef.version}`] = comDef
        }
      })
    }

    comLibs.forEach(lib => {
      const comAray = lib.comAray
      if (comAray) {
        regAry(comAray)
      }
    })

    return comDefs
  }, [])

  const getComDef = useCallback((def) => {
    return comDefs[`${def.namespace}-${def.version}`]
  }, [])

  //环境变量，此处可以定义连接器、多语言等实现
  const env = Object.assign({
    runtime: {},
    i18n(text) {
      return text
    }
  }, defEnv)

  const {slot, script} = json

  //根据script生成context对象
  const context = useMemo(() => {
    try {
      return eval(json.script)({comDefs, env},{observable})
    } catch (ex) {
      console.error(ex)
    }
  }, [])

  //开始递归渲染
  return (
    <RenderSlot slot={slot}
                env={env}
                getComDef={getComDef}
                getContext={context.get}/>
  )
}

function RenderSlot({slot, env, getComDef, getContext}) {
  return (
    slot.map(com => {//组件逐个渲染
      const {id, def, slots} = com
      const comDef = getComDef(def)
      if (comDef) {
        //在context中获取各类对象
        const {data, style, inputs, outputs} = getContext(id)

        //递归渲染插槽
        const slotsProxy = new Proxy({}, {
          get(target, slotId) {
            const props = getContext(id, slotId)
            return {
              render() {
                const slot = slots[slotId]

                return (
                  <RenderSlot slot={slot}
                              env={env}
                              getComDef={getComDef}
                              getContext={getContext}/>
                )
              },
              inputs: props.inputs,
              outputs: props.outputs
            }

          }
        })


        return (
          <div key={id} style={{display: style.display}}>
            <comDef.runtime env={env}
                            data={data}
                            style={style}
                            slots={slotsProxy}
                            inputs={inputs}
                            outputs={outputs}/>
          </div>
        )
      } else {
        return (
          <div>
            {def.namespace} not found
          </div>
        )
      }
    })
  )
}
