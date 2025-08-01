import { Style } from "@mybricks/render-types";
import { isNumber } from '../type';
import { findGCD } from "../normal";
import { sortByTopLeft } from "./sort";
import { handleIntersectionsAndInclusions } from "./relation"
import { getCombinationElements } from "./mergeGroup";
import { rowFlexLayout, columnFlexLayout } from "./flexLayout";
import type { Elements, DefaultLayoutConfig as LayoutConfig } from './'

export type ResultElement = {
  id: string;
  style: Style;
  elements: Array<ResultElement>;
  child?: ResultElement;
  brother: [];
}

export function ps(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export function log(...args) {
  return console.log(...args)
}

/**
 * 智能布局分组规则
 * - 就近成组，相邻元素最近的成为一组
 * - 水平方向没有元素
 *   -- 元素宽度为填充，需要向下查找元素，一般都是是否居中
 *   -- 元素宽度非填充，自成一组，不参与分组合并
 * - 任意方向相交，自成一组
 *  
 * 对比元素只需要先向右，再向下对比即可
 */
export default function combination(elements: Elements, layoutConfig: LayoutConfig): Array<ResultElement> {
  const fixedAbsoluteElements = []
  /** 处理相交关系 */
  const initElements = handleIntersectionsAndInclusions(elements.filter((element) => {
    if (["fixed", "absolute"].includes(element.style.position)) {
      fixedAbsoluteElements.push(element)
      return false
    }
    return true
  }))
  /** 基于规则开始分组 */
  let finalElements = getCombinationElements(sortByTopLeft(initElements), layoutConfig.style)

  // 纵向比较特殊，如果有bottom或者heightFull，才合并
  // if (finalElements.length === 1 && layoutConfig.style.flexDirection === "column") {
  //   if (finalElements[0].style.flexDirection === "column") {
  //     if (!finalElements[0].elements.find((element) => element.style.bottom || element.style.heightFull)) {
  //         // 如果没有，需要拆开
  //         finalElements = finalElements[0].elements
  //       }
  //   }
  // }

  /** 计算最终的布局关系 */
  let res = calculateLayoutRelationship(finalElements, layoutConfig);

  if (res.length > 1 && res.find((element) => element.style.heightFact)) {
    /** 填充具体像素值 */
    const flexPX: number[] = [];
    /** 上述数组的index对应的元素位置 calculateComAry[index] */
    const flexPXIndexToStyleMap = {};
    /** 设置填充的元素具体像素合 */
    let flexSumPX = 0;

    res.forEach((element) => {
      const { id, style } = element
      if (style.heightFact) {
        /** push元素具体宽度 */
        flexPX.push(style.heightFact)
        /** 计算总宽度 */
        flexSumPX = flexSumPX + style.heightFact;
        /** 记录元素位置 */
        flexPXIndexToStyleMap[flexPX.length - 1] = id;

        Reflect.deleteProperty(style, "marginBottom")
      }
    })

    if (flexPX.length) {
      // 横向可能存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexPX)
      flexPX.forEach((height, index) => {
        const style = res.find((element) => element.id === flexPXIndexToStyleMap[index]).style
        style.flex = height / gcd
      })
    }

    const fEle = finalElements[0]
    const lEle = finalElements[finalElements.length - 1]

    Reflect.deleteProperty(res[0].style, "marginTop")

    res = [{
      id: res[0].id,
      elements: res,
      style: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        marginTop: fEle.style.top,
        marginBottom: layoutConfig.style.height - (lEle.style.top + lEle.style.height)
      }
    }]
  }
  // res.length && log("最终结果: ", ps(res.concat(fixedAbsoluteElements)))
  return res.concat(fixedAbsoluteElements);
}

export function calculateLayoutRelationship(elements: Elements, layoutConfig: LayoutConfig) {
  /** 最终计算后的结果 */
  const finalElements: any[] = [];
  const {
    /** 子元素排列方向 */
    flexDirection,
    /** 父元素距上距离 */
    top,
    /** 父元素距下距离 */
    bottom,
    /** 父元素距左距离 */
    left,
    /** 父元素距右距离 */
    right,
    /** 父元素宽度 */
    width,
    /** 父元素高度 */
    height,
    /** 父元素非自动成组标识 */
    isNotAutoGroup,
  } = layoutConfig.style;

  if (flexDirection === "column") {
    /** 纵向排列 - 向下 */
    const { startOnBottom, startOnTop } = layoutConfig
    /** 元素计算的key */
    let calculateKey;
    /** 当前计算值 */
    let currentKeyValue;
    /** 最终给到容器的key */
    let finalKey;
    /** 横向排列 - 向右 */
    if (startOnBottom) {
      // 默认是下边
      currentKeyValue = isNotAutoGroup ? 0 : elements[elements.length - 1].style.bottom;
      calculateKey = 'bottom'
      finalKey = 'marginBottom'
    } else {
      // 默认是上边
      currentKeyValue = isNotAutoGroup ? 0 : elements[0].style.top;
      calculateKey = 'top'
      finalKey = 'marginTop'
    }

    /** 填充具体像素值 */
    const flexPX: number[] = [];
    /** 上述数组的index对应的元素位置 calculateComAry[index] */
    const flexPXIndexToStyleMap = {};
    /** 设置填充的元素具体像素合 */
    let flexSumPX = 0;

     
    // 不是自动自动成组的话，直接使用元素高度，否则需要计算
    /** 当前元素距上边距离，用于计算子元素的外间距marginTop */

    /** 
     * 将元素从上至下排序
     * 遍历
     */
    elements.sort((preElement, curElement) => preElement.style[calculateKey] - curElement.style[calculateKey]).forEach((element) => {
      /** 递归计算element.elements */
      const { id, style } = element;

      /** 最终的外层样式 */
      let finalStyle = {}

      if (element.elements) {
        // 成组了
        if (element.style.flexDirection === "row") {
          // 横向排列
          const { style: parentStyle, elements } = rowFlexLayout(element, layoutConfig)
          element.elements = elements
          finalStyle = parentStyle
        } else if (element.style.flexDirection === "column") {
          // log("下一步是处理这块逻辑")
          // 纵向排列
          // 居下实现，放开下方注释
          // const { style: parentStyle, elements } = columnFlexLayout(element, layoutConfig)
          // element.elements = elements
          // finalStyle = parentStyle
        } else {
          // element.elements = calculateLayoutRelationship(element.elements, {
          //   // @ts-ignore
          //   style: {
          //     ...element.style,
          //     flexDirection: "column",
          //     top: 0,
          //     bottom: 0,
          //   },
          //   startOnTop: true
          // })
        }
      }

      /** 当前元素上下外间距 */
      const margin = style[calculateKey] - currentKeyValue;

      let finalElement

      /** 当前元素左外间距 */
      const marginLeft = style.left

      /** 当前元素右外间距 */
      const marginRight = width - marginLeft - style.width;

      if (style.heightFull) {
        flexPX.push(style.height)
        flexSumPX = flexSumPX + style.height;
        flexPXIndexToStyleMap[flexPX.length - 1] = id;
      }

      if (!style.widthFull) {
        /** 当前元素未铺满 */
        if (
          /** 没有right属性 */
          typeof style.right !== "number" && 
          /** 当前元素左侧距容器间距与右侧距容器间距相同时 */
          (Math.abs(marginLeft - marginRight) <= 1 || style.xCenter) && 
          /** 非自动成组 - 搭建时手动框选成组 */
          isNotAutoGroup && 
          /** 没有flexDirection说明是单个组件 */
          !style.flexDirection
        ) {
          /** 居中 */
          if (style.flexDirection) {
            console.log("【@mybricks/render-utils: 智能布局计算】: 只有单组件、非自动成组的才参与居中计算，不应该走到这段逻辑，观察一段时间，后续删除")
            /** 成组 - 非单组件 */
            finalElement = {
              ...element,
              id,
              style: {
                [finalKey]: margin,
                display: "flex",
                justifyContent: "center",
                flexDirection: style.flexDirection,
              }
            }
          } else {
            /** 
             * 未成组 - 单组件 
             * 由于居中，要多套一层div
             */
            const childStyle: any = {
              width: style.width,
              height: style.height,
            }
            const parentStyle: any = {
              [finalKey]: margin,
              display: "flex",
              width: "100%",
              justifyContent: 'center',
            }
            if (style.heightFull) {
              const marginBottom = height - margin - style.height;
              childStyle.height = '100%';
              parentStyle.marginBottom = marginBottom;
              parentStyle.height = '100%';
              parentStyle.heightFact = style.height;
            }
            finalElement = {
              id,
              elements: [{
                ...element,
                id,
                style: childStyle,
              }],
              style: parentStyle,
            }
          }
        } else {
          /** 不居中 */
          if (style.flexDirection) {
            /** 成组 - 非单组件 */
            // 成组情况下，无论是否居右都无所谓，因为数据来自finalStyle
            const parentStyle: any = {
              ...finalStyle,
              [finalKey]: margin,
            }
            if (style.heightFull) {
              const marginBottom= height - margin - style.height;
              parentStyle.marginBottom = marginBottom;
              parentStyle.height = '100%';
              parentStyle.heightFact = style.height;
            }
            finalElement = {
              ...element,
              id,
              style: parentStyle
            }
          } else {
            /** 
             * 未成组 - 单组件 
             * 不居中，计算间距即可
             */
            if (isNumber(style.right)) {
              /**
               * 单组件居右
               * 外面再套一层div
               */
              const childStyle: any = {
                width: style.width,
                height: style.height,
              }
              const parentStyle: any = {
                display: "flex",
                justifyContent: "flex-end",
                [finalKey]: margin,
                marginRight: style.right
              }
              if (style.heightFull) {
                const marginBottom = height - margin - style.height;
                childStyle.height = '100%';
                parentStyle.marginBottom = marginBottom;
                parentStyle.height = '100%';
                parentStyle.heightFact = style.height;
              }
              
              finalElement = {
                id,
                style: parentStyle,
                elements: [{
                  ...element,
                  id,
                  style: childStyle,
                }]
              }
            } else {
              /**
               * 单组件非居右
               * 正常计算
              */
              const parentStyle: any = {
                width: style.width,
                height: style.height,
                [finalKey]: margin,
                marginLeft, // 不居中要设置左边距
              }
              if (style.heightFull) {
                parentStyle.height = '100%';
                parentStyle.heightFact = style.height;
                if (isNotAutoGroup) {
                  const marginBottom = height - margin - style.height;
                  parentStyle.marginBottom = marginBottom;
                }
              }
              finalElement = {
                ...element,
                id,
                style: parentStyle,
              }
            }
          }
        }
      } else {
        /** 当前元素铺满 */
        if (style.flexDirection) {
          /** 成组 - 非单组件 */

          const parentStyle: any = {
            marginRight,
            ...finalStyle,
            [finalKey]: margin,
          }

          if (style.heightFull) {
            const marginBottom= height - margin - style.height;
            parentStyle.height = '100%';
            parentStyle.heightFact = style.height;
            parentStyle.marginBottom = marginBottom;
          }

          finalElement = {
            ...element,
            id,
            style: parentStyle
          }
        } else {
          /** 未成组 - 单组件 */
          const parentStyle: any = {
            width: 'auto',
            height: style.height,
            [finalKey]: margin,
            marginRight,
            marginLeft
          }
          if (style.heightFull) {
            parentStyle.height = '100%';
            parentStyle.heightFact = style.height;
            if (isNotAutoGroup) {
              const marginBottom = height - margin - style.height;
              parentStyle.marginBottom = marginBottom;
            }
          }

          finalElement = {
            ...element,
            id,
            style: parentStyle
          }
        }
      }

      if (startOnBottom) {
        finalElements.unshift(finalElement)
      } else {
        finalElements.push(finalElement)
      }

      /** 设置当前元素距上边距离，用于计算下一个元素的上外间距 */
      currentKeyValue = currentKeyValue + margin + style.height
    });
    if (flexPX.length) {
      // 横向可能存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexPX)
      flexPX.forEach((height, index) => {
        const style = finalElements.find((element) => element.id === flexPXIndexToStyleMap[index]).style
        style.flex = height / gcd
      })
    }
  } else {
    const { startOnRight, startOnLeft } = layoutConfig
    /** 元素计算的key */
    let calculateKey;
    /** 当前计算值 */
    let currentKeyValue;
    /** 最终给到容器的key */
    let finalKey;
    /** 横向排列 - 向右 */
    if (startOnRight) {
      // 默认是右边
      currentKeyValue = isNotAutoGroup ? 0 : elements[elements.length - 1].style.right;
      calculateKey = 'right'
      finalKey = 'marginRight'
    } else {
      // 默认是左边
      currentKeyValue = isNotAutoGroup ? 0 : elements[0].style.left;
      calculateKey = 'left'
      finalKey = 'marginLeft'
    }

    /** 填充具体像素值 */
    const flexPX: number[] = [];
    /** 上述数组的index对应的元素位置 calculateComAry[index] */
    const flexPXIndexToStyleMap = {};
    /** 设置填充的元素具体像素合 */
    let flexSumPX = 0;

    /** 
     * 将元素从左至右排序
     * 遍历
     */
    elements.sort((preElement, curElement) => preElement.style[calculateKey] - curElement.style[calculateKey]).forEach((element, index) => {
      const { id, style } = element;

      if (element.elements) {
        element.elements = calculateLayoutRelationship(element.elements, {
          // @ts-ignore
          style
        })
      }

      if (style.widthFull) {
        /** push元素具体宽度 */
        flexPX.push(style.width)
        /** 计算总宽度 */
        flexSumPX = flexSumPX + style.width;
        /** 记录元素位置 */
        flexPXIndexToStyleMap[flexPX.length - 1] = id;
      }

      /** 当前元素左右外间距 */
      const margin = style[calculateKey] - currentKeyValue;

      let finalElement


      /** 当前元素上外间距 */
      const marginTop = style.top; // 前置已经把上间距做好计算了

      if (!style.widthFull) {
        /** 当前元素未铺满 */
        if (style.flexDirection) {
          /** 成组 - 非单组件 */
          finalElement = {
            ...element,
            id,
            style: {
              marginTop,
              display: 'flex',
              flexDirection: style.flexDirection,
              [finalKey]: margin
            },
          }
        } else {
          const parentStyle: any = {
            width: style.width,
            height: style.height,
            marginTop,
            [finalKey]: margin
          }
          if (style.heightFull) {
            parentStyle.height = '100%';
            const marginBottom = height - marginTop - style.height;
            parentStyle.marginBottom = marginBottom;
          }
          /** 未成组 - 单组件 */
          finalElement = {
            ...element,
            id: element.id,
            style: parentStyle,
          }
        }
      } else {
        /** 当前元素铺满 */
        if (style.flexDirection) {
          /** 成组 - 非单组件 */
          finalElement = {
            ...element,
            id,
            style: {
              display: 'flex',
              flexDirection: style.flexDirection,
              marginTop,
              [finalKey]: margin
            },
          }
        } else {
          /** 未成组 - 单组件 */
          const parentStyle: any = {
            height: style.height,
            marginTop,
            [finalKey]: margin
          }

          if (style.heightFull) {
            const marginBottom = height - marginTop - style.height;
            parentStyle.height = '100%';
            parentStyle.heightFact = style.height;
            parentStyle.marginBottom = marginBottom;
          }

          finalElement = {
            ...element,
            id,
            style: parentStyle
          }
        }
      }

      if (startOnRight) {
        finalElements.unshift(finalElement)
      } else {
        finalElements.push(finalElement)
      }

      /** 设置当前元素外间距，用于计算下一个元素的外间距 */
      currentKeyValue = currentKeyValue + margin + style.width
    })

    if (flexPX.length) {
      // 横向可能存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexPX)
      flexPX.forEach((width, index) => {
        const style = finalElements.find((element) => element.id === flexPXIndexToStyleMap[index]).style
        style.flex = width / gcd
        /** 下面两个属性，需要再观察下，后续这类样式设置需要写明原因或遇到的问题 */
        style.overflow = 'hidden'
        style.minWidth = '0px'
      })
    }
  }

  return finalElements;
}
