import smartLayout from "./smartLayout";

interface ToJSON {
  [key: string]: any
}

export function transformToJSON(toJSON: ToJSON) {
  const { global, modules, scenes } = toJSON 
  if (!scenes) {
    if (toJSON.slot) {
      return transformSingleToJSON(toJSON)
    }
    return toJSON
  }
  if (global) {
    const { comsReg, consReg, pinRels, fxFrames, pinProxies } = global
    if (comsReg) {
      Object.keys(comsReg).forEach((key) => {
        comsReg[key].global = true
      })
    }
    if (Array.isArray(fxFrames)) {
      fxFrames.forEach((fxFrame) => {
        if (comsReg) {
          Object.assign(fxFrame.coms, comsReg)
        }
        if (consReg) {
          Object.assign(fxFrame.cons, consReg)
        }
        if (pinRels) {
          Object.assign(fxFrame.pinRels, pinRels)
        }
        if (pinProxies) {
          Object.assign(fxFrame.pinProxies, pinProxies)
        }
      })
    }
    
    // TODO: 临时写死的，等引擎提供数据
    const transform = new Transform()

    if (modules) {
      Object.entries(modules).forEach(([key, module]: any) => {
        const { json } = module
        transform.transformSlotComAry(json.slot, json.coms)

        if (comsReg) {
          Object.assign(json.coms, comsReg)
        }
        if (consReg) {
          Object.assign(json.cons, consReg)
        }
        if (pinRels) {
          Object.assign(json.pinRels, pinRels)
        }
        if (pinProxies) {
          Object.assign(json.pinProxies, pinProxies)
        }
      })
    }

    scenes.forEach((scene: any) => {
      transform.transformSlotComAry(scene.slot, scene.coms)

      if (comsReg) {
        Object.assign(scene.coms, comsReg)
      }
      if (consReg) {
        Object.assign(scene.cons, consReg)
      }
      if (pinRels) {
        Object.assign(scene.pinRels, pinRels)
      }
      if (pinProxies) {
        Object.assign(scene.pinProxies, pinProxies)
      }
    })
  }

  return toJSON
}

/** 
 * 提前处理全局变量、全局FX相关数据，渲染时不再需要关心，
 * 这段逻辑有没有可能再生成tojson的时候调一下，渲染时能够更轻
 * 向外暴露 transformJSON 函数？
 */
export function transformSingleToJSON(toJSON: any) {
  const transform = new Transform()
  transform.transformSlotComAry(toJSON.slot, toJSON.coms)
  return toJSON
}

class Transform {

  comIdToSlotComMap = {}

  constructor() {}

  transformSlotComAry(slot, coms) {
    const { comIdToSlotComMap } = this
    const { comAry } = slot
  
    // TODO: 目前引擎可以通过这个字段来判断是否智能布局
    if (slot.style.layout === "smart") {
      const resultComAry = comAry.sort((preCom, curCom) => {
        const { id: preId } = preCom
        const { id: curId } = curCom
  
        const preStyle = coms[preId].model.style
        const preTop = preStyle.top
        const preLeft = preStyle.left
        const curStyle = coms[curId].model.style
        const curTop = curStyle.top
        const curLeft = curStyle.left
    
        if (preTop === curTop) {
          return preLeft - curLeft
        }
    
        return preTop - curTop
      })

      comAry.forEach(({slots}) => {
        if (slots) {
          Object.entries(slots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
      })
      const comAry2 = smartLayout(resultComAry.map((com) => {
        const id = com.id
        const comInfo = coms[id]
        const style = comInfo.model.style
        const calculateStyle = comInfo.style

        comIdToSlotComMap[id] = com

        return {
          id,
          style: {
            width: calculateStyle.width,
            height: calculateStyle.height,
            top: typeof style.bottom === 'number' ? slot.style.height - calculateStyle.height - style.bottom : (style.top || 0),
            left: typeof style.right === 'number' ? slot.style.width - calculateStyle.width - style.right : (style.left || 0),
            // right: style.right,
            // bottom: style.bottom,
            widthFull: style.widthFull,
            widthAuto: style.widthAuto,
            heightAuto: style.heightAuto,
            constraints: comInfo.constraints
          },
        }

      }), { style: { width: slot.style.width }})

      const traverseElementsToSlotComAry3 = (comAry) => {
        const result = []
        comAry.forEach((com) => {
          const { id, style, elements } = com
          Reflect.deleteProperty(com, "tempStyle")

          if (Array.isArray(elements)) {
            Reflect.deleteProperty(style, 'height')
            result.push({
              ...com,
              elements: traverseElementsToSlotComAry3(elements)
            })
          } else {
            const modelStyle = coms[id].model.style
            modelStyle.position = 'relative'
            if (modelStyle.heightAuto) {
              modelStyle.height = 'auto'
            }
            // if (modelStyle.height === 'auto') {
            //   modelStyle.height = 'fit-content'
            // }
            // if (modelStyle.flexY === 1) {
            //   Reflect.deleteProperty(modelStyle, "height")
            // }

            // widthAuto 适应内容
            // widthFull 填充
            if (modelStyle.widthAuto) {
              modelStyle.maxWidth = modelStyle.width
              modelStyle.width = "fit-content"
            }

            if (style.flex) {
              modelStyle.flex = style.flex
              modelStyle.margin = style.margin
              Reflect.deleteProperty(modelStyle, "width")
              Reflect.deleteProperty(modelStyle, "maxWidth")
            } else if (style.width === 'auto') {
              modelStyle.margin = style.margin
              modelStyle.width = 'auto'
              Reflect.deleteProperty(modelStyle, "maxWidth") // 后续去掉，智能布局下没有这个属性了
            } else {
              modelStyle.marginTop = style.marginTop
              modelStyle.marginLeft = style.marginLeft
            }
            result.push(comIdToSlotComMap[id])
          }
        })
    
        return result
      }

      slot.layoutTemplate = traverseElementsToSlotComAry3(comAry2)
    } else {
      comAry.forEach((com) => {
        const { slots } = com
        if (slots) {
          Object.entries(slots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
      })
    }
  }
}
