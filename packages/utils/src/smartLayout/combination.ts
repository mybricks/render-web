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
  let finalElements = getCombinationElements(sortByTopLeft(initElements))

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
  const res = calculateLayoutRelationship(finalElements, layoutConfig);
  // res.length && log("最终结果: ", ps(res.concat(fixedAbsoluteElements)))
  return res.concat(fixedAbsoluteElements);
}

export function calculateLayoutRelationship(elements: Elements, layoutConfig: LayoutConfig) {
  /** 最终计算后的结果 */
  const finalElements: any[] = [];
  const {
    /** 子元素排列方向 */
    flexDirection,
    /** 父元素距顶距离 */
    top,
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

    /** 当前元素距上边距离，用于计算子元素的外间距marginTop */
    let currentTop = top;

    /** 
     * 将元素从上至下排序
     * 遍历
     */
    elements.sort((preElement, curElement) => preElement.style.top - curElement.style.top).forEach((element) => {
      /** 递归计算element.elements */
      const { id, style } = element;
      /** 当前元素上外间距 */
      const marginTop = style.top - currentTop;

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
          log("下一步是处理这块逻辑")
          // 纵向排列
          // const { style: parentStyle, elements } = columnFlexLayout(element, layoutConfig)
          // element.elements = elements
          // finalStyle = parentStyle
        }
      }

      /** 当前元素左外间距 */
      const marginLeft = isNotAutoGroup ? style.left - left : 0; // 如果没成组，需要计算，成组后的left是0，直接是0即可

      /** 当前元素右外间距 */
      const marginRight = width - marginLeft - style.width;

      if (!style.widthFull) {
        /** 当前元素未铺满 */
        if (
          /** 当前元素左侧距容器间距与右侧距容器间距相同时 */
          Math.abs(marginLeft - marginRight) <= 1 && 
          /** 非自动成组 - 搭建时手动框选成组 */
          isNotAutoGroup && 
          /** 没有flexDirection说明是单个组件 */
          !style.flexDirection
        ) {
          /** 居中 */
          if (style.flexDirection) {
            console.log("【@mybricks/render-utils: 智能布局计算】: 只有单组件、非自动成组的才参与居中计算，不应该走到这段逻辑，观察一段时间，后续删除")
            /** 成组 - 非单组件 */
            finalElements.push({
              ...element,
              id,
              style: {
                marginTop,
                display: "flex",
                justifyContent: "center",
                flexDirection: style.flexDirection,
              }
            })
          } else {
            /** 
             * 未成组 - 单组件 
             * 由于居中，要多套一层div
             */
            finalElements.push({
              id,
              elements: [{
                ...element,
                id,
                style: {
                  /** 记录当前元素宽高，可能还要继续计算的 */
                  width: style.width,
                  height: style.height,
                },
              }],
              style: {
                marginTop,
                display: "flex",
                justifyContent: 'center',
              },
            })
          }
        } else {
          /** 不居中 */
          if (style.flexDirection) {
            /** 成组 - 非单组件 */
            if (isNumber(style.right)) {
              // 居右
              finalElements.push({
                ...element,
                id,
                style: {
                  ...finalStyle,
                  marginTop
                }
              })
            } else {
              finalElements.push({
                ...element,
                id,
                style: {
                  marginTop,
                  marginLeft, // 不居中要设置左边距
                  display: "flex",
                  flexDirection: style.flexDirection,
                }
              })
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
              finalElements.push({
                id,
                style: {
                  // 容器样式
                  display: "flex",
                  justifyContent: "flex-end",
                  /** 上距离 */
                  marginTop,
                  /** 右距离 */
                  marginRight: style.right
                },
                elements: [{
                  ...element,
                  id,
                  style: {
                    // 组件样式
                    width: style.width,
                    height: style.height,
                  },
                }]
              })
            } else {
              /**
               * 单组件非居右
               * 正常计算
              */
              finalElements.push({
                ...element,
                id,
                style: {
                  width: style.width,
                  height: style.height,
                  marginTop,
                  marginLeft, // 不居中要设置左边距
                },
              })
            }
          }
        }
      } else {
        /** 当前元素铺满 */
        if (style.flexDirection) {
          /** 成组 - 非单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              // width: 'auto', // 不需要width默认就是auto
              ...finalStyle,
              marginTop,
              marginLeft,
              marginRight,
              // 下面两个也可以不要了
              // display: 'flex',
              // flexDirection: style.flexDirection,
            }
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              width: 'auto', // TODO: 在tojson.ts内，如果widht是auto，可以把auto也删除
              height: style.height,
              marginTop,
              // TODO: 单组件横向铺满，需要放开
              marginRight,
              marginLeft
            }
          })
        }
      }

      /** 设置当前元素距上边距离，用于计算下一个元素的上外间距 */
      currentTop = currentTop + marginTop + style.height;
    });
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
      currentKeyValue = right
      calculateKey = 'right'
      finalKey = 'marginRight'
    } else {
      // 默认是左边
      currentKeyValue = left
      calculateKey = 'left'
      finalKey = 'marginLeft'
    }
   
    /** 收集 设置 widthFull 的元素具体宽度，计算 flex 比例 */
    const flexXWidths: number[] = [];
    /** 上述数组的index对应的元素位置 elements[index] */
    const flexXIndexToStyleMap = {};
    /** 设置 widthFull 的元素具体宽度合 */
    let flexXSumWidth = 0;

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

      /** 当前元素左外间距 */
      const margin = style[calculateKey] - currentKeyValue;

      let finalElement


      /** 当前元素上外间距 */
      const marginTop = style.top - top;

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
          /** 未成组 - 单组件 */
          finalElement = {
            ...element,
            id: element.id,
            style: {
              width: style.width,
              height: style.height,
              marginTop,
              [finalKey]: margin
            },
          }
        }
      } else {
        /** 当前元素铺满 */

        /** push元素具体宽度 */
        flexXWidths.push(style.width)
        /** 计算总宽度 */
        flexXSumWidth = flexXSumWidth + style.width;
        /** 记录元素位置 */
        flexXIndexToStyleMap[flexXWidths.length - 1] = id;

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
          finalElement = {
            ...element,
            id,
            style: {
              /** 不需要宽度，最终会设置flex属性 */
              height: style.height,
              marginTop,
              [finalKey]: margin
            },
          }
        }
      }

      if (startOnLeft) {
        finalElements.push(finalElement)
      } else {
        finalElements.unshift(finalElement)
      }

      /** 设置当前元素外间距，用于计算下一个元素的外间距 */
      currentKeyValue = currentKeyValue + margin + style.width
    })

    if (flexXWidths.length) {
      // 横向可能存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexXWidths)
      flexXWidths.forEach((width, index) => {
        const style = finalElements.find((element) => element.id === flexXIndexToStyleMap[index]).style
        style.flex = width / gcd
        /** 下面两个属性，需要再观察下，后续这类样式设置需要写明原因或遇到的问题 */
        style.overflow = 'hidden'
        style.minWidth = '0px'
      })
    }
  }

  return finalElements;
}
