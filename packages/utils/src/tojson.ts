import { ToJSON, ToUiJSON, Slot, Coms, ComponentNode } from "@mybricks/render-types";
import smartLayout, { ResultElement } from "./smartLayout";
import { isNumber } from "./type";

/** 处理引擎提供的toJSON数据 */
export function transformToJSON(toJSON: ToJSON | ToUiJSON) {
  const { global, modules, scenes } = toJSON as ToJSON;
  if (!scenes) {
    // 非多场景
    if ((toJSON as ToUiJSON).slot) {
      // 有UI组件
      return transformSingleToJSON(toJSON as ToUiJSON)
    }
    // 纯逻辑
    return toJSON
  }
  if (global) {
    const { comsReg, consReg, pinRels, fxFrames, pinProxies } = global
    if (comsReg) {
      Object.keys(comsReg).forEach((key) => {
        if (comsReg[key].def.namespace === "mybricks.core-comlib.var") {
          // 全局变量，设置global属性
          comsReg[key].global = true
        }
      })
    }

    // 处理全局FX
    if (Array.isArray(fxFrames)) {
      // 将全局组件信息合并入fxjson
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

    // 处理模块
    if (modules) {
      // 将全局组件信息合并入modulejson
      Object.entries(modules).forEach(([key, module]: any) => {
        const { json } = module
        // 模块在搭建时已被引擎调用transformToJSON处理，不用重复处理

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

    // 处理多场景
    scenes.forEach((scene: any) => {
      // 智能布局相关计算
      transformSlotComAry(scene.slot, scene.coms)
      // 将全局组件信息合并入场景json
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

  // 返回结果
  return toJSON
}

/** 处理引擎提供的toJSON数据 - 非多场景含UI部分 */
export function transformSingleToJSON(toJSON: ToUiJSON) {
  transformSlotComAry(toJSON.slot, toJSON.coms)
  return toJSON
}

type ComIdToSlotComMap = {
  [key: string]: ComponentNode
}

/** 智能布局计算 */
function transformSlotComAry(
  // 插槽信息
  slot: Slot, 
  // 组件信息
  coms: Coms, 
  // TODO: 是否根节点，目前没用
  root = true, 
  // 有com传入的话说明在插槽内
  com?: ComponentNode
) {
  // 通过组件ID查找对应的Slot.comAry内组件信息
  const comIdToSlotComMap: ComIdToSlotComMap = {}
  const { comAry } = slot
  // 过滤脏数据，不过也不应该有脏数据，需要引擎把控
  const calculateComAry = comAry.filter(({id}) => coms[id])
  // 目前引擎可以通过这个字段来判断是否智能布局
  if (slot.style.layout === "smart") {
    calculateComAry.forEach((com) => {
      const { slots } = com
      // 深度遍历组件插槽，插槽内可能也是智能布局，需要做计算
      if (slots) {
        const component = coms[com.id]
        // TODO: 目前没什么用
        const isroot = component.model.style.heightAuto
        Object.entries(slots).forEach(([slotId, slot]) => {
          transformSlotComAry(slot, coms, isroot, com)
        })
      }
    })

    // 插槽的内边距
    const paddingTop = parseFloat(slot.style.paddingTop)
    const paddingLeft = parseFloat(slot.style.paddingLeft)
    const paddingRight = parseFloat(slot.style.paddingRight)
    const paddingBottom = parseFloat(slot.style.paddingBottom) 
    // 插槽可能不存在width、height属性，需要从widthFact、heightFact获取具体的宽高
    let slotWidth = slot.style.width || slot.style.widthFact
    let slotHeight = slot.style.height || slot.style.heightFact

    // 插槽内真实宽高需要减去内边距
    if (isNumber(paddingTop)) {
      slotHeight = slotHeight - paddingTop
    }
    if (isNumber(paddingLeft)) {
      slotWidth = slotWidth - paddingLeft
    }
    if (isNumber(paddingRight)) {
      slotWidth = slotWidth - paddingRight
    }
    if (isNumber(paddingBottom)) {
      slotHeight = slotHeight - paddingBottom
    }
    
    // 智能布局计算
    const layoutTemplate = smartLayout(calculateComAry.map((com, index) => {
      // 组件唯一ID
      const id = com.id
      // 组件详细信息
      const comInfo = coms[id]
      // 组件样式信息
      const style = comInfo.model.style
      // 用于计算的样式信息，仅包含真实具体的width、height属性
      const calculateStyle = comInfo.style
      // 设置 id => com 的映射
      comIdToSlotComMap[id] = com
      // 设置zIndex样式，组件层级默认越靠后越高，与引擎同步，防止因布局计算问题导致混乱
      style.zIndex = index + 1

      return {
        id,
        style: {
          width: calculateStyle.width,
          height: calculateStyle.height,
          // 有bottom情况下，需要计算top值
          top: typeof style.bottom === 'number' ? slotHeight - calculateStyle.height - style.bottom : (style.top || 0),
          // 有right情况下，需要计算top值
          left: typeof style.right === 'number' ? slotWidth - calculateStyle.width - style.right : (style.left || 0),
          // 有right说明居右
          right: style.right,
          // TODO: 有bottom说明居下，还未实现
          bottom: style.bottom,
          // 是否铺满 -> 等比缩放
          widthFull: style.widthFull,
          // 是否自适应 -> 适应内容
          widthAuto: style.widthAuto,
        },
      }
    }), {
      // 容器样式信息
      style: {
        width: slotWidth,
        height: slotHeight,
        isNotAutoGroup: true
      },
      // 是否根节点
      root
    })

    if (com) {
      // 说明是在插槽内，插槽需要根据组件的宽高配置做调整，删除插槽样式里的宽高属性
      // 组件详细信息
      const component = coms[com.id]
      // 组件样式信息
      const { style } = component.model

      // TODO: 下方计算目前没遇到问题，应该还需要调整
      if (!style.heightAuto && !style.heightFull) {

      } else if (style.heightAuto) {
        // 组件高度适应内容，删除插槽的高度，默认auto
        Reflect.deleteProperty(slot.style, "height")
      } else {
        // 组件高度等比缩放，删除插槽的高度，默认auto
        Reflect.deleteProperty(slot.style, "height")
      }

      if (!style.widthAuto && !style.widthFull) {

      } else if (style.widthAuto) {
        // 组件宽度适应内容，删除插槽的高度，默认auto
        Reflect.deleteProperty(slot.style, "width")
      } else {
        // 组件宽度等比缩放，删除插槽的高度，默认auto
        Reflect.deleteProperty(slot.style, "width")
      }
    }
    // 计算最终结果
    slot.layoutTemplate = traverseElementsToSlotComAry(layoutTemplate, coms, comIdToSlotComMap)
  } else {
    /** 是自由布局吗 */
    const isAbsolute = slot.style.layout === "absolute"
    if (com) {
      // 非智能布局，删除插槽的宽高属性
      Reflect.deleteProperty(slot.style, "width")
      Reflect.deleteProperty(slot.style, "height")
    }
    calculateComAry.forEach((com) => {
      const { slots } = com
      const component = coms[com.id]
      if (isAbsolute) {
        // 自由布局的话，给布局内所有组件设置position为absolute
        component.model.style.position = "absolute";
        const { style: { paddingTop, paddingLeft } } = slot;
        try {
          // 计算top值，需要算上上内边距
          const top = parseFloat(paddingTop);
          if (top) {
            component.model.style.top = component.model.style.top + top
          }
        } catch {}
        try {
          // 计算top值，需要算上左内边距
          const left = parseFloat(paddingLeft);
          if (left) {
            component.model.style.left = component.model.style.left + left
          }
        } catch {}
      }
      if (slots) {
        // TODO: 目前没什么用
        const isroot = component.model.style.heightAuto
        Object.entries(slots).forEach(([slotId, slot]) => {
          transformSlotComAry(slot, coms, isroot, com)
        })
      }

      // 组件样式信息
      const style = component.model.style

      // 非智能布局，也需要判断宽高的配置
      if (style.heightAuto) {
        // 高度适应内容 - 设置height: fit-content
        if (isAbsolute) {
          // 绝对定位
          Reflect.deleteProperty(style, "height") // safari浏览器，元素绝对定位后使用fit-content导致高度塌陷
          style.minHeight = "fit-content"
          style.maxHeight = "fit-content"
        } else {
          // 非绝对定位
          // @ts-ignore
          style.height = "fit-content"
        }
      } else if (style.heightFull) {
        // 高度等比缩放 - 设置height: 100%
        // @ts-ignore
        style.height = "100%"
      } else {
        if ("height" in style) {
          // 如果有高度属性，设置高度
          style.height = component.style.height
        }
      }

      if (style.widthAuto) {
        // 宽度适应内容 - 设置width: fit-content
        // @ts-ignore
        style.width = "fit-content"
      } else if (style.widthFull) {
        // 宽度等比缩放 - 设置height: 100%
        // @ts-ignore
        style.width = "100%"
      } else {
        if ("width" in style) {
          // 如果有宽度属性，设置宽度
          style.width = component.style.width
        }
      }

      if (component.asRoot) {
        // TODO: 根组件，默认设置为height:100%，目前为了小程序场景做的修改，持续观察下
        // @ts-ignore
        style.height = '100%';
      }
    })
  }
}

function traverseElementsToSlotComAry(comAry: ResultElement[], coms: Coms, comIdToSlotComMap: ComIdToSlotComMap) {
  const result = []
  comAry.forEach((com) => {
    const { id, style, elements } = com

    if (Array.isArray(elements)) {
      // 如果有elements说明是成组了，将style内计算用的高度删除
      Reflect.deleteProperty(style, 'height')
      // 深度遍历元素节点
      const realElements = traverseElementsToSlotComAry(elements, coms, comIdToSlotComMap)
      if (!["space-between", "center", "flex-end"].includes(style.justifyContent) && realElements.filter((element) => {
        const { id, def, style } = element
        if (def) {
          const style = coms[id].model.style
          // @ts-ignore
          return style.width === "fit-content"
        } else {
          return style.width === "fit-content"
        }
      }).length === realElements.length) {
        // 没有justifyContent属性，并且素有元素的宽度都是fit-content，那么width需要设置为fit-content
        style.width = "fit-content"
      }
      result.push({
        ...com,
        elements: realElements
      })
    } else {
      // 真实组件，非成组元素
      // 组件样式信息
      const modelStyle = coms[id].model.style
      // 设置具体宽度
      modelStyle.width = coms[id].style.width
      if ("height" in coms[id].model.style) {
        modelStyle.height = coms[id].style.height
      }
      // 设置默认position为relative
      modelStyle.position = style.position || 'relative'

      // 如果是absolute，绝对定位，设置计算的top和left
      if (modelStyle.position === "absolute") {
        // @ts-ignore
        modelStyle.top = style.top
        // @ts-ignore
        modelStyle.left = style.left
      }

      if (modelStyle.heightAuto) {
        // 高度适应内容 - 设置height: fit-content
        if (modelStyle.position === "absolute") {
          // 绝对定位
          Reflect.deleteProperty(modelStyle, "height") // safari浏览器，元素绝对定位后使用fit-content导致高度塌陷
          modelStyle.minHeight = "fit-content"
          modelStyle.maxHeight = "fit-content"
        } else {
          // 非绝对定位
          // @ts-ignore
          modelStyle.height = "fit-content"
        }

        // TODO: 下面这一段暂时用不到了，当时是为了做智能布局下显示隐藏默认占位，目前已经不使用了
        if (modelStyle.display === "none") {
          // 已经确认，智能布局下默认是占位的模式，其余动作组件自己来实现
          modelStyle.visibility = 'hidden'
        } else {
          modelStyle.visibility = 'visible'
        }
        modelStyle.display = 'flex'
        modelStyle.flexDirection = 'column'

        /** TODO: 是否在智能布局中 */
        // @ts-ignore
        modelStyle.inSmartLayout = true;
      }

      // widthAuto 适应内容
      // widthFull 填充
      if (modelStyle.widthAuto) {
        // 宽度适应内容
        // @ts-ignore
        modelStyle.width = "fit-content"
        // 左右布局，适应内容的文本，会把右侧元素挤出画布
        modelStyle.flexShrink = 1
      }

      if (style.flex) {
        // 有flex属性，说明是有等比缩放的
        modelStyle.flex = style.flex
        modelStyle.margin = style.margin
        // 删除宽度相关属性
        Reflect.deleteProperty(modelStyle, "width")
        Reflect.deleteProperty(modelStyle, "maxWidth") // 后续去掉，智能布局下没有这个属性了
        // 设置最小宽度
        modelStyle.minWidth = style.minWidth
      } else if (style.width === 'auto') {
        // 计算后宽度是等比缩放
        modelStyle.margin = style.margin
        // @ts-ignore
        modelStyle.width = 'auto'
        Reflect.deleteProperty(modelStyle, "maxWidth") // 后续去掉，智能布局下没有这个属性了
      } else {
        // TODO: 应该全都计算好？
        if (!modelStyle.margin) {
          modelStyle.margin = `${style.marginTop || 0}px ${style.marginRight || 0}px ${style.marginBottom || 0}px ${style.marginLeft || 0}px`
        }
      }

      // 目前没有 marginBottom
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
