import { ToJSON, ToUiJSON, Slot, Coms, ComponentNode, DomNode, SlotStyle, ComponentStyle, Style, Component, Slots } from "@mybricks/render-types";
import smartLayout, { ResultElement } from "./smartLayout";
import { isNumber } from "./type";
import { generatePropertyRemover, findGCD } from "./normal";
import { convertCamelToHyphen } from "./regexp";

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
        // const component = coms[com.id]
        // TODO: 目前没什么用
        // const isroot = component.model.style.heightAuto
        Object.entries(slots).forEach(([slotId, slot]) => {
          transformSlotComAry(slot, coms, false, com)
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

    if (root && !slot.type) {
      Reflect.deleteProperty(slot.style, "width");
      Reflect.deleteProperty(slot.style, "height")
    }

    // 插槽内真实宽高需要减去内边距
    if (isNumber(paddingTop)) { // 仅页面画布去除width和height属性
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

      if (style.position === "absolute") {
        Reflect.deleteProperty(style, "position")
      }

      return {
        id,
        style: {
          width: calculateStyle.width,
          height: calculateStyle.height,
          // 有bottom情况下，需要计算top值
          top: typeof style.bottom === 'number' ? slotHeight - calculateStyle.height - style.bottom : (style.top || 0),
          // 有right情况下，需要计算top值
          left: typeof style.right === 'number' ? slotWidth - calculateStyle.width - style.right : (style.left || 0),
          // position
          position: style.position,
          // 有right说明居右
          right: style.right,
          // TODO: 有bottom说明居下，还未实现
          bottom: style.bottom,
          // 是否铺满 -> 等比缩放
          widthFull: style.widthFull,
          // 是否自适应 -> 适应内容
          widthAuto: style.widthAuto,
          // 是否铺满 -> 等比缩放
          heightFull: style.heightFull,
          // 是否自适应 -> 适应内容
          heightAuto: style.heightAuto,
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

      const remover = generatePropertyRemover(slot.style)

      // TODO: 下方计算目前没遇到问题，应该还需要调整
      if (!style.heightAuto && !style.heightFull) {

      } else if (style.heightAuto) {
        // 组件高度适应内容，删除插槽的高度，默认auto
        remover("height")
      } else {
        // 组件高度等比缩放，删除插槽的高度，默认auto
        remover("height")
      }

      if (!style.widthAuto && !style.widthFull) {

      } else if (style.widthAuto) {
        // 组件宽度适应内容，删除插槽的高度，默认auto
        remover("width")
      } else {
        // 组件宽度等比缩放，删除插槽的高度，默认auto
        remover("width")
      }
    }
    // 计算最终结果
    slot.layoutTemplate = traverseElementsToSlotComAry(layoutTemplate, coms, comIdToSlotComMap)
  } else {
    // 不是智能布局，删除引擎带来的无用字段
    Reflect.deleteProperty(slot, "layoutTemplate");
    /** 是自由布局吗 */
    const isAbsolute = slot.style.layout === "absolute"
    if (com) {
      // 非智能布局，删除插槽的宽高属性
      Reflect.deleteProperty(slot.style, "width")
      Reflect.deleteProperty(slot.style, "height")
    }

    /** 是纵向排列 */
    const isFlexColumn = slot.style.layout === "flex-column";

    /** 填充具体像素值 */
    const flexPX: number[] = [];
    /** 上述数组的index对应的元素位置 calculateComAry[index] */
    const flexPXIndexToStyleMap = {};
    /** 设置填充的元素具体像素合 */
    let flexSumPX = 0;

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
        // const isroot = component.model.style.heightAuto
        Object.entries(slots).forEach(([slotId, slot]) => {
          transformSlotComAry(slot, coms, false, com)
        })
      }

      // 组件样式信息
      const style = component.model.style

      const calculateStyle = component.style

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
        // style.flexShrink = 1 // TODO: 之后去掉，完成高度填充后即可实现
        if (!isAbsolute) {
          if (isFlexColumn) {
            flexPX.push(calculateStyle.height)
            flexSumPX += calculateStyle.height
            flexPXIndexToStyleMap[flexPX.length - 1] = com.id;
          }
        }
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
        if (!isAbsolute) {
          if (!isFlexColumn) {
            flexPX.push(calculateStyle.width)
            flexSumPX += calculateStyle.width
            flexPXIndexToStyleMap[flexPX.length - 1] = com.id;
          }
        }
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

      // 对组件样式做处理，去除运行时无关的内容
      component.model.style = getComponentStyle(style);
    })

    if (flexPX.length) {
      // 存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexPX)
      flexPX.forEach((px, index) => {
        const style = coms[flexPXIndexToStyleMap[index]].model.style
        style.flex = px / gcd
      })
    }
  }

  // 对插槽样式做处理，去除运行时无关的内容
  slot.style = getSlotStyle(slot.style);
}

function traverseElementsToSlotComAry(comAry: ResultElement[], coms: Coms, comIdToSlotComMap: ComIdToSlotComMap) {
  const result = []
  comAry.forEach((com) => {
    const { id, style, elements } = com

    if (Array.isArray(elements)) {
      // 如果有elements说明是成组了，将style内计算用的高度删除
      if (isNumber(style.height)) {
        // 如果是具体的值，将style内计算用的高度删除
        Reflect.deleteProperty(style, 'height')
      }
      Reflect.deleteProperty(style, "heightFact")
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
      transformMargin(style, false)
      result.push({
        ...com,
        elements: realElements
      })
    } else {
      // 根据智能布局返回结果修改model.style
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
        // modelStyle.flexShrink = 1
      }

      const { marginTop, marginRight, marginBottom, marginLeft, width, height, ...other } = style;
      if (isNumber(marginTop)) {
        modelStyle.marginTop = marginTop
      }
      if (isNumber(marginRight)) {
        modelStyle.marginRight = marginRight
      }
      if (isNumber(marginBottom)) {
        modelStyle.marginBottom = marginBottom
      }
      if (isNumber(marginLeft)) {
        modelStyle.marginLeft = marginLeft
      }

      if (style.flex) {
        modelStyle.flex = style.flex
      }

      if (!isNumber(width)) {
        // @ts-ignore
        modelStyle.width = width
      }
      if (!isNumber(height)) {
        // @ts-ignore
        modelStyle.height = height
      }

      // @ts-ignore
      if (modelStyle.width === "auto") {
        Reflect.deleteProperty(modelStyle, "maxWidth")
      }

      // 对组件样式做处理，去除运行时无关的内容
      coms[id].model.style = getComponentStyle(Object.assign(modelStyle, other));

      const resultElement: any = {
        ...comIdToSlotComMap[id]
      }
      const { child, brother } = com;

      if (brother?.length) {
        resultElement.brother = traverseElementsToSlotComAry(brother, coms, comIdToSlotComMap)
      }
      if (child) {
        if (com.style.width === "auto") {
          child.style.paddingLeft = com.style.marginLeft
          child.style.paddingRight = com.style.marginRight
        }
        resultElement.child = {
          ...com.child,
          elements: traverseElementsToSlotComAry(com.child.elements || [], coms, comIdToSlotComMap)
        }
      }

      result.push(resultElement)
    }
  })

  return result
}

/** 
 * TODO: 提前计算插槽样式 -> 持续更新
 * 1. 优化样式，去除无用信息
 * 2. 提前计算部分样式，减少运行时计算
 */
function getSlotStyle(style: SlotStyle) {
  const remover = generatePropertyRemover(style);

  switch (style.layout) {
    case 'flex-row':
    case 'flex-column':
      break;
    default:
      // 不是flex布局，删除引擎带来的运行时无用的样式
      remover("alignItems");
      remover("justifyContent");
      break;
  }

  // 删除引擎带来的运行时无用的样式
  remover("widthFact");
  remover("heightFact");
  // remover("layout"); // TODO: 目前layout有用的，后续看能不能删除
  // 引擎返回的，干嘛用的这是
  remover("zoom");

  return style;
}

/** 
 * TODO: 提前计算组件样式 -> 持续更新
 * 1. 优化样式，去除无用信息
 * 2. 提前计算部分样式，减少运行时计算
 */
function getComponentStyle(style: any) { // toJSON定义的样式，会被修改，这里如何来定义ts
  const remover = generatePropertyRemover(style);
  // 组件外部的样式应该只保留position、以及宽高相关属性
  if (style.display !== "none") {
    remover("display");
  }
  remover("flexDirection");

  if (!["fixed", "absolute"].includes(style.position)) {
    // 不是自由布局，删除四个方向属性
    remover("left");
    remover("top");
    remover("right");
    remover("bottom");
  } else {
    if (isNumber(style.bottom)) {
      remover("top");
      // if (isNumber(style.bottomAsFixed)) {
      //   style.bottom = style.bottomAsFixed
      //   remover("bottomAsFixed")
      // }
    } else {
      // if (isNumber(style.topAsFixed)) {
      //   style.top = style.topAsFixed
      //   remover("topAsFixed")
      // }
    }
    if (isNumber(style.right)) {
      remover("left");
      // if (isNumber(style.rightAsFixed)) {
      //   style.right = style.rightAsFixed
      //   remover("rightAsFixed")
      // }
    } else {
      // if (isNumber(style.leftAsFixed)) {
      //   style.left = style.leftAsFixed
      //   remover("leftAsFixed")
      // }
    }
  }

  // 删除引擎带来的运行时无用的样式
  remover("widthFact");
  remover("widthAuto");
  remover("widthFull");
  remover("heightFact");
  remover("heightAuto");
  remover("heightFull");

  style._new = true; // TODO: 有旧数据需要兼容，作为新数据的标识

  transformMargin(style);

  return style;
}

/** 间距转换 */
function transformMargin(style, hasSize = true) {
  const {
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft
  } = style;
  // 间距特殊处理
  if ((hasSize && !width) || ["100%", "auto"].includes(width)) {
    // 说明是 宽度等比缩放
    if (isNumber(marginLeft) && marginLeft > 0) {
      // 使用paddingLeft
      style.paddingLeft = marginLeft
      Reflect.deleteProperty(style, "marginLeft")
    }
    if (isNumber(marginRight) && marginRight > 0) {
      // 使用paddingRight
      style.paddingRight = marginRight
      Reflect.deleteProperty(style, "marginRight")
    }
  }

  if ((hasSize && !height) || ["100%", "auto"].includes(height)) {
     // 说明是 高度等比缩放
     if (isNumber(marginTop) && marginTop > 0) { 
      // 使用paddingTop
      style.paddingTop = marginTop
      Reflect.deleteProperty(style, "marginTop")
    }
    if (isNumber(marginBottom) && marginBottom > 0) {
      // 使用paddingBottom
      style.paddingBottom = marginBottom
      Reflect.deleteProperty(style, "marginBottom")
    }
  }
}

type TransformStyle = {
  [key: string]: Style;
}

/** 获取组件风格化代码，可用于写入style标签 */
export async function getStyleInnerHtml(
  toJSON: ToJSON | ToUiJSON,
  options: {
    transformStyle?: (style: TransformStyle) => TransformStyle;
    pxToVw?: {
      viewportWidth: number;
      unitPrecision: number;
    }
  } = {}) {
  const promiseAry = [];
  let innerHtml = "";
  const { modules, scenes, themes } = toJSON as ToJSON;
  const comThemes = themes?.comThemes;
  const { pxToVw, transformStyle } = options;
  const handlePxToVw = pxToVw ? getPxToVw(pxToVw) : null;
  
  if (scenes) {
    // 多场景
    scenes.forEach((json) => {
      getStyleInnerHtmlByUiJson(json);
    })
    if (modules) {
      Object.entries(modules).forEach(([, { json }]) => {
        getStyleInnerHtmlByUiJson(json);
      })
    }
    Reflect.deleteProperty(toJSON, "themes");
  } else {
    // 非多场景
    getStyleInnerHtmlByUiJson(toJSON as ToUiJSON);
  }
  function getStyleInnerHtmlByUiJson(json: ToUiJSON) {
    Object.entries(json.coms).forEach(([, com]) => {
      const styleAry = getStyleAry(com)

      if (Array.isArray(styleAry)) {
        styleAry.forEach(({css, selector, global}) => {
          if (selector === ':root') {
            selector = '> *:first-child'
          }
          const comId = com.id
          if (Array.isArray(selector)) {
            selector.forEach((selector) => {
              getStyleInnerText({id: comId, css, selector, global})
            })
          } else {
            getStyleInnerText({id: comId, css, selector, global})
          }
        })
      }

      getStyleInnerText({id: com.id, css: comCssPropertiesToValueString(com.model.style) })
    })
    traversalSlots(null, {[json.id]: json.slot});
    return innerHtml;
  }
  function slotCssPropertiesToValueString(slotStyle: SlotStyle) {
    const { layout, ...other } = slotStyle;
    const responseSlotStyle: Style = {}
    if (layout === "smart") {

    } else if (layout === "flex-column") {
      responseSlotStyle.display = "flex";
      responseSlotStyle.flexDirection = "column";
      Reflect.deleteProperty(slotStyle, "layout");
    } else if (layout === "flex-row") {
      responseSlotStyle.display = "flex";
      responseSlotStyle.flexDirection = "row";
      Reflect.deleteProperty(slotStyle, "layout");
    }

    return Object.entries(other).reduce((responseSlotStyle, [key, value]) => {
      if (["justifyContent", "flexDirection", "alignItems"].includes(key)) {
        Reflect.deleteProperty(slotStyle, key);
      }
      responseSlotStyle[key] = value;
      return responseSlotStyle;
    }, responseSlotStyle);
  }
  function traversalSlots(comId: string, slots: Slots) {
    Object.entries(slots).forEach(([slotId, slot]) => {
      const { style, comAry, layoutTemplate } = slot;
      getStyleInnerText({ id: comId, global: comId ? false : true, css: slotCssPropertiesToValueString(style), selector: `[data-slot-id="${slotId}"]`});
      traversalComAry(style.layout === "smart" ? layoutTemplate : comAry);
    })
  }
  function traversalComAry(comAry: (ComponentNode | DomNode)[]) {
    comAry.forEach((com) => {
      if ("elements" in com) {
        traversalComAry(com.elements)
      } else {
        const { slots }= com;
        if (slots) {
          traversalSlots(com.id, slots);
        }
      }
    })
  }
  function getStyleAry(com: Component) {
    const style = com.model.style
    let styleAry = style.styleAry
    const themesId = style.themesId
    Reflect.deleteProperty(style, 'styleAry')
    Reflect.deleteProperty(style, 'themesId')

    if (!comThemes) {
      return styleAry
    }
    const { namespace } = com.def
    if (!themesId && !styleAry) {
      // 去找默认值
      const comThemeAry = comThemes[namespace]
      if (Array.isArray(comThemeAry)) {
        const comTheme = comThemeAry.find(({ isDefault }) => isDefault)
        if (comTheme) {
          styleAry = comTheme.styleAry
        }
      }
    } else if (themesId !== '_defined') {
      // 去找相应的内容
      const comThemeAry = comThemes[namespace]
      if (Array.isArray(comThemeAry)) {
        const comTheme = comThemeAry.find(({ id }) => id === themesId)
        if (comTheme) {
          styleAry = comTheme.styleAry
        }
      }
    }

    return styleAry
  }
  function getStyleInnerText ({ id, css, selector = "", global = false }) {
    const responseSelector = `${global ? '' : `#${id} `}${selector.replace(/\{id\}/g, `${id}`)}`;
    if (transformStyle) {
      const responseStyle = transformStyle({
        [responseSelector]: css
      });

      if (responseStyle instanceof Promise) {
        promiseAry.push(new Promise((r) => {
          responseStyle.then((style) => {
            innerHtml += Object.entries(style).reduce((p, [id, css]) => {
              return p + '\n' + cssPropertiesToString({ id, css })
            }, "");
            r(style);
          })
        }))
      } else {
        innerHtml += Object.entries(responseStyle).reduce((p, [id, css]) => {
          return p + '\n' + cssPropertiesToString({ id, css })
        }, "");
      }
    } else {
      innerHtml += cssPropertiesToString({ id: responseSelector, css });
    }
  }
  function cssPropertiesToString({ id, css }: { id: string; css: Style }) {
    return `
      ${id} {
        ${Object.keys(css).map(key => {
          let value = css[key]
          if (handlePxToVw && typeof value === "string" && value.indexOf('px') !== -1) {
            value = handlePxToVw(value)
          }
          return `${convertCamelToHyphen(key)}: ${value};`
        }).join('\n')}
      }
    `
  }

  await Promise.all(promiseAry);
  
  return innerHtml
}

function toFixed(number, precision) {
  var multiplier = Math.pow(10, precision + 1);
  var wholeNumber = Math.floor(number * multiplier);
  return Math.round(wholeNumber / 10) * 10 / multiplier;
}
function createPxReplacer(perRatio, minPixelValue, unitPrecision, unit) {
  return function (origin, $1) {
    var pixels = parseFloat($1);

    if (!$1 || pixels <= minPixelValue) {
      return origin;
    } else {
      // @ts-ignore
      return "".concat(toFixed(pixels / perRatio, unitPrecision)).concat(unit);
    }
  };
}
function getPxToVw({ viewportWidth = 375, unitPrecision = 5 }) {
  const REG_PX = /"[^"]+"|'[^']+'|url\([^)]+\)|(\d*\.?\d+)px/g;
  const vwReplace = createPxReplacer(viewportWidth / 100, 0, unitPrecision, 'vw');
  return (value) => {
    return value.replace(REG_PX, vwReplace);
  }
}
function comCssPropertiesToValueString(style: Style) {
  return Object.entries(style).reduce((css, [key, value]) => {
    if (!["width", "height"].includes(key)) {
      Reflect.deleteProperty(style, key);
    }
    if (["width", "height", "left", "top", "right", "bottom", "marginLeft", "marginRight", "marginTop", "marginBottom", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom"].includes(key) && isNumber(value)) {
      // 枚举引擎配置
      css[key] = value + 'px';
    } else {
      css[key] = value;
    }
    return css;
  }, {});
}

