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
        if (comsReg[key].def.namespace === "mybricks.core-comlib.var") {
          comsReg[key].global = true
        }
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
    // const transform = new Transform()

    if (modules) {
      Object.entries(modules).forEach(([key, module]: any) => {
        const { json } = module
        // transform.transformSlotComAry(json.slot, json.coms)
        // 这里应该不用执行的，模块在搭建的时候已经计算好了
        // transformSlotComAry(json.slot, json.coms)

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
      // transform.transformSlotComAry(scene.slot, scene.coms)
      transformSlotComAry(scene.slot, scene.coms)

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
  // const transform = new Transform()
  // transform.transformSlotComAry(toJSON.slot, toJSON.coms)
  transformSlotComAry(toJSON.slot, toJSON.coms)
  return toJSON
}

function transformSlotComAry(slot, coms, root = true, com?) {
  const comIdToSlotComMap = {}
  const { comAry } = slot
  const calculateComAry = comAry.filter(({id}) => coms[id])
  // TODO: 目前引擎可以通过这个字段来判断是否智能布局
  if (slot.style.layout === "smart") {
    // 不需要提前排序
    // const resultComAry = calculateComAry.sort((preCom, curCom) => {
    //   const { id: preId } = preCom
    //   const { id: curId } = curCom

    //   const preStyle = coms[preId].model.style
    //   const preTop = preStyle.top
    //   const preLeft = preStyle.left
    //   const curStyle = coms[curId].model.style
    //   const curTop = curStyle.top
    //   const curLeft = curStyle.left
  
    //   if (preTop === curTop) {
    //     return preLeft - curLeft
    //   }
  
    //   return preTop - curTop
    // })

    calculateComAry.forEach((com) => {
      const { slots } = com
      if (slots) {
        const component = coms[com.id]
        const isroot = component.model.style.heightAuto
        Object.entries(slots).forEach(([slotId, slot]) => {
          transformSlotComAry(slot, coms, isroot, com)
        })
      }
    })
    const comAry2 = smartLayout(calculateComAry.map((com) => {
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
          right: style.right,
          bottom: style.bottom,
          widthFull: style.widthFull,
          widthAuto: style.widthAuto,
          heightAuto: style.heightAuto,
          // constraints: comInfo.constraints
        },
      }

    }), { style: { width: slot.style.width, height: slot.style.height, isNotAutoGroup: true }, root })

    if (com) {
      /** 删除插槽样式里的宽高属性 */
      

      const component = coms[com.id]
      const { style } = component.model

      // 现在数据有问题，缺width、height属性
      if (!style.heightAuto && !style.heightFull) {
        // console.log("定高，不删除插槽的高度")
        // slot.style.overflowY = "hidden" // 删除，应该不需要？插槽按理说是组件自己控制的
      } else if (style.heightAuto) {
        // console.log("高度自适应")
        Reflect.deleteProperty(slot.style, "height")
      } else {
        // console.log("高度铺满")
        Reflect.deleteProperty(slot.style, "height")
      }

      if (!style.widthAuto && !style.widthFull) {
        // console.log("定宽，不删除插槽的宽度")
        // slot.style.overflowX = "hidden" // 删除，发现使用overflowX:hidden后，纵向会产生滚动 - http://work.manateeai.com/mybricks-app-mpsite/index.html?id=555294873813061 - TOP3(new)模块
      } else if (style.widthAuto) {
        // console.log("宽度自适应")
        Reflect.deleteProperty(slot.style, "width")
      } else {
        // console.log("宽度铺满")
        Reflect.deleteProperty(slot.style, "width")
      }
    }
    slot.layoutTemplate = traverseElementsToSlotComAry(comAry2, coms, comIdToSlotComMap)
  } else {
    /** 是自由布局吗 */
    const isAbsolute = slot.style.layout === "absolute"
    /** 非智能布局，删除插槽的宽高 */
    if (com) {
      Reflect.deleteProperty(slot.style, "width")
      Reflect.deleteProperty(slot.style, "height")
    }
    calculateComAry.forEach((com) => {
      const { slots } = com
      const component = coms[com.id]
      if (isAbsolute) {
        /** 自由布局的话，给布局内所有组件设置position为absolute */
        component.model.style.position = "absolute";
        const { style: { paddingTop, paddingLeft } } = slot;
        try {
          const top = parseFloat(paddingTop);
          if (top) {
            component.model.style.top = component.model.style.top + top
          }
        } catch {}
        try {
          const left = parseFloat(paddingLeft);
          if (left) {
            component.model.style.left = component.model.style.left + left
          }
        } catch {}
      }
      if (slots) {
        const isroot = component.model.style.heightAuto
        Object.entries(slots).forEach(([slotId, slot]) => {
          transformSlotComAry(slot, coms, isroot, com)
        })
      }

      /** 非智能布局，也需要判断宽高的配置 */
      const style = component.model.style

      if (style.heightAuto) {
        if (isAbsolute) {
          Reflect.deleteProperty(style, "height") // safari浏览器，元素绝对定位后使用fit-content导致高度塌陷
          style.minHeight = "fit-content"
          style.maxHeight = "fit-content"
        } else {
          style.height = "fit-content"
        }
      } else if (style.heightFull) {
        style.height = "100%"
      } else {
        if ("height" in style) {
          style.height = component.style.height
        }
      }

      if (style.widthAuto) {
        style.width = "fit-content"
      } else if (style.widthFull) {
        style.width = "100%"
      } else {
        if ("width" in style) {
          style.width = component.style.width
        }
      }
    })
  }
}

function traverseElementsToSlotComAry(comAry, coms, comIdToSlotComMap) {
  const result = []
  comAry.forEach((com) => {
    const { id, style, elements } = com
    Reflect.deleteProperty(com, "tempStyle")

    if (Array.isArray(elements)) {
      Reflect.deleteProperty(style, 'height')
      const realElements = traverseElementsToSlotComAry(elements, coms, comIdToSlotComMap)
      // 居中不需要设置fit-content 
      // 有justifyContent属性的话，不需要设置fit-content
      // 这里是domNode
      if (!["space-between", "center", "flex-end"].includes(style.justifyContent) && realElements.filter((element) => {
        const { id, def, style } = element
        if (def) {
          const style = coms[id].model.style
          return style.width === "fit-content"
        } else {
          return style.width === "fit-content"
        }
      }).length === realElements.length) {
        style.width = "fit-content"
      }
      result.push({
        ...com,
        elements: realElements
      })
    } else {
      const modelStyle = coms[id].model.style
      // modelStyle.width = style.width
      // modelStyle.height = style.height
      modelStyle.width = coms[id].style.width
      modelStyle.height = coms[id].style.height
      modelStyle.position = style.position || 'relative'

      // 如果是absolute，设置计算的top和left
      if (modelStyle.position === "absolute") {
        modelStyle.top = style.top
        modelStyle.left = style.left
      }

      if (modelStyle.heightAuto) {
        // modelStyle.height = 'auto'
        // modelStyle.maxHeight = "fit-content"
        if (modelStyle.position === "absolute") {
          Reflect.deleteProperty(modelStyle, "height") // safari浏览器，元素绝对定位后使用fit-content导致高度塌陷
          modelStyle.minHeight = "fit-content"
          modelStyle.maxHeight = "fit-content"
        } else {
          modelStyle.height = "fit-content"
        }
        // Reflect.deleteProperty(modelStyle, "height")
        // modelStyle.minHeight = style.height

        if (modelStyle.display === "none") {
          // 已经确认，智能布局下默认是占位的模式，其余动作组件自己来实现
          modelStyle.visibility = 'hidden'
        } else {
          modelStyle.visibility = 'visible'
        }
        modelStyle.display = 'flex'
        modelStyle.flexDirection = 'column'
        // 一级子元素设置flex：1

        /** TODO: 是否在智能布局中 */
        modelStyle.inSmartLayout = true;
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
        // modelStyle.maxWidth = "fit-content"
        modelStyle.width = "fit-content"
        // 左右布局，适应内容的文本，会把右侧元素挤出画布
        modelStyle.flexShrink = 1
        // modelStyle.minWidth = style.width
      }
      // if (modelStyle.widthAuto) {
      //   modelStyle.maxWidth = modelStyle.width
      //   modelStyle.width = "fit-content"
      // }

      if (style.flex) {
        modelStyle.flex = style.flex
        modelStyle.margin = style.margin
        Reflect.deleteProperty(modelStyle, "width")
        Reflect.deleteProperty(modelStyle, "maxWidth")
        modelStyle.minWidth = style.minWidth
      } else if (style.width === 'auto') {
        modelStyle.margin = style.margin
        modelStyle.width = 'auto'
        Reflect.deleteProperty(modelStyle, "maxWidth") // 后续去掉，智能布局下没有这个属性了
      } else {
        if (!modelStyle.margin) {
          modelStyle.margin = `${style.marginTop || 0}px ${style.marginRight || 0}px ${style.marginBottom || 0}px ${style.marginLeft || 0}px`
        }
        // modelStyle.marginTop = style.marginTop
        // modelStyle.marginLeft = style.marginLeft
      }

      modelStyle.marginBottom = style.marginBottom
      result.push({
        ...comIdToSlotComMap[id],
        // 添加兄弟节点，目前节点在组件dom内部
        brother: traverseElementsToSlotComAry(com.brother || [], coms, comIdToSlotComMap),
        // 添加children节点
        child: com.child ? {
          ...com.child,
          elements: traverseElementsToSlotComAry(com.child.elements || [], coms, comIdToSlotComMap)
        } : null
      })
    }
  })

  return result
}