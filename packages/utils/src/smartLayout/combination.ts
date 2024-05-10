import { Style } from "@mybricks/render-types";
import { isNumber } from '../type';
import { sortByTopLeft } from "./sort";
import { handleIntersectionsAndInclusions } from "./relation"
import { getCombinationElements } from "./mergeGroup";
import type { Elements, DefaultLayoutConfig as LayoutConfig } from './'

export type ResultElement = {
  id: string;
  style: Style;
  elements: Array<ResultElement>;
  child?: ResultElement;
  brother: [];
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
  /** 处理相交关系 */
  const initElements = handleIntersectionsAndInclusions(elements)
  /** 基于规则开始分组 */
  const finalElements = getCombinationElements(sortByTopLeft(initElements))
  /** 计算最终的布局关系 */
  const res = calculateLayoutRelationship(finalElements, layoutConfig);
  // res.length && console.log("最终结果: ", res)
  return res;
}

function findGCD(arr) {
  // 找到数组中的最小值
  const min = Math.min(...arr);

  // 初始化公约数为最小值
  let gcd = min;

  // 从最小值开始递减，直到找到最大公约数
  while (gcd > 1) {
    let isGCD = true;

    // 检查数组中的每个元素是否能被公约数整除
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] % gcd !== 0) {
        isGCD = false;
        break;
      }
    }

    // 如果所有元素都能被公约数整除，则找到最大公约数
    if (isGCD) {
      break;
    }

    // 否则，继续递减公约数
    gcd--;
  }

  return gcd;
}

function calculateLayoutRelationship(elements: Elements, layoutConfig: LayoutConfig) {
  /** 最终计算后的结果 */
  const finalElements: any[] = [];
  const {
    /** 子元素排列方向 */
    flexDirection,
    /** 父元素距顶距离 */
    top,
    /** 父元素距左距离 */
    left,
    /** 父元素宽度 */
    width,
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
      if (element.elements) {
        /** 有elements，一定是成组的 */
        const { style, elements } = element;
        /** 从左至右排序，再找出最左边居右的元素 */
        const rightIndex = elements.sort((p, c) => p.style.left - c.style.left).findIndex((element) => typeof element.style.right === "number");

        if (rightIndex !== -1) {
          /** 居左的元素 */
          const leftElements = elements.slice(0, rightIndex);
          /** 居右的元素 */
          const rightElements = elements.slice(rightIndex);

          /** 当前元素上外间距 */
          const marginTop = style.top - currentTop;
          /** 当前元素左外间距 */
          const marginLeft = style.left - left;
          /** 最后一个元素 */
          const nextElementStyle = rightElements[rightElements.length - 1].style;
          const marginRight = width - (nextElementStyle.left - left) - nextElementStyle.width;

          if (!leftElements[0]) {
            /** 整行都是居右的 */
            finalElements.push({
              id: elements[0].id,
              elements: calculateLayoutRelationship(element.elements.map((element) => {
                /** TODO: 居右的情况下，是不是子元素都采用marginRight? */
                Reflect.deleteProperty(element.style, "right")
                return element
              }), {
                // @ts-ignore
                style: element.style,
                // root: true
              }),
              style: {
                // margin: `${marginTop}px ${marginRight}px ${0}px ${marginLeft}px`,
                marginTop,
                /** 左距离 单个组件的话不需要设置marginLeft，直接使用flex-end放置在右侧 */
                // marginLeft,
                marginRight,
                display: "flex",
                justifyContent: "flex-end", // 全部居右，相当于单组件居右，使用 flex-end
                flexDirection: style.flexDirection,
                flexWrap: "wrap", // 小屏换行？
              }
            })
          } else {
            /** 左侧第一个元素 */
            const leftFirstElement = leftElements[0];
            /** 左侧最后一个元素 */
            const leftLastElement = leftElements[leftElements.length -1];
            /** 右侧第一个元素 */
            const rightFirstElement = rightElements[0];
            /** 右侧最后一个元素 */
            const rightLastElement = rightElements[rightElements.length -1];


            /** 左侧是否有填充组件 */
            let hasLeftWidthFull = false;
            /** 左侧填充比例 */
            let leftFlex;
            /** 左边元素总宽度 */
            let leftWidth = leftElements.reduce((p, c, index) => {
              if (c.style.widthFull) {
                hasLeftWidthFull = true;
              }
              /** 第一项不需要计算 left  */
              return p + (index ? (c.style.left + c.style.width) : c.style.width);
            }, 0);
            /** 右侧是否有填充组件 */
            let hasRightWidthFull = false;
            /** 右侧填充比例 */
            let rightFlex;
            /** 右边元素总宽度 */
            let rightWidth = rightElements.reduce((p, c, index) => {
              if (c.style.widthFull) {
                hasRightWidthFull = true;
              }
              /** 第一项不需要计算 left  */
              return p + (index ? (c.style.left + c.style.width) : c.style.width);
            }, 0)


            if (hasLeftWidthFull && !hasRightWidthFull) {
              /** 左填充 右不填充 */
              leftFlex = 1;
            } else if (!hasLeftWidthFull && hasRightWidthFull) {
              /** 左不填充 右填充 */
              rightFlex = 1;
            } else if (hasLeftWidthFull && hasRightWidthFull) {
              /** 两边都填充 */
              const gcd = findGCD([leftWidth, rightWidth])
              leftFlex = leftWidth / gcd;
              rightFlex = rightWidth / gcd;

              /** 下面两个属性，需要再观察下，后续这类样式设置需要写明原因或遇到的问题 */
              // style.overflow = 'hidden'
              // style.minWidth = '0px'
            }

            /** 最终左侧的元素 */
            let resultLeftElement;
            /** 最终右侧的元素 */
            let resultRightElement;

            /** 父容器样式 */
            const parentStyle: any = {
              margin: `${marginTop}px ${marginRight}px ${0}px ${marginLeft}px`,
              display: "flex",
              justifyContent: "space-between", // 居右的情况下，使用space-between
              flexDirection: style.flexDirection,
              flexWrap: "wrap", // 小屏换行？
            };
            if (hasLeftWidthFull || hasRightWidthFull) {
              /** 任意一边有宽度填充的话，需要设置横向间距 */
              parentStyle.columnGap = rightFirstElement.style.left - (leftLastElement.style.left + leftLastElement.style.width);
            }

            if (leftElements.length < 2) {
              /** 只有一个元素 */
              if (leftFirstElement.style.widthFull) {
                resultLeftElement = {
                  ...leftFirstElement,
                  style: {
                    ...leftFirstElement.style,
                    // marginTop: leftFirstElement.style.top - style.top,
                    margin: `${leftFirstElement.style.top - style.top}px ${0}px ${0}px ${0}px`,
                    /** TODO: auto的情况下要用margin，后面整体改一下吧 */
                    width: 'auto',
                    flex: leftFlex
                  }
                }
                if (Array.isArray(leftFirstElement.elements)) {
                  resultLeftElement.style.display = "flex";
                  resultLeftElement.style.flexDirection = resultLeftElement.style.flexDirection;
                  resultLeftElement.elements = calculateLayoutRelationship(resultLeftElement.elements, {
                    // @ts-ignore
                    style: {// TODO 看看还缺什么，明天继续吧
                      top: style.top, // 这个应该用父元素的top值
                      left: resultLeftElement.style.left,
                      width: leftWidth,
                      height: style.height,
                      flexDirection: resultLeftElement.style.flexDirection,
                      // @ts-ignore
                      widthFull: hasLeftWidthFull,
                    },
                    // root: true
                  })
                  // console.log("resultLeftElement.elements 结果", resultLeftElement.elements)
                }
              } else {
                resultLeftElement = {
                  ...leftFirstElement,
                  style: {
                    ...leftFirstElement.style,
                    marginTop: leftFirstElement.style.top - style.top
                  }
                }
                if (Array.isArray(resultLeftElement.elements)) {
                  resultLeftElement.elements = calculateLayoutRelationship(resultLeftElement.elements, {
                    style: resultLeftElement.style,
                    // root: true
                  })
                }
              }
            } else {
              /** 多个元素 */
              resultLeftElement = {
                id: leftFirstElement.id,
                style: {
                  /** 这里生成的是最终的样式，不再参与计算 */
                  // @ts-ignore
                  display: "flex",
                  flexDirection: style.flexDirection,
                  flex: leftFlex
                },
                elements: calculateLayoutRelationship(leftElements, { // TODO: 这里等会看看 应该要删除right属性的，在计算后
                  // @ts-ignore
                  style: {// TODO 看看还缺什么，明天继续吧
                    top: style.top, // 这个应该用父元素的top值
                    left: leftFirstElement.style.left,
                    width: leftWidth,
                    height: style.height,
                    flexDirection: style.flexDirection,
                    // @ts-ignore
                    widthFull: hasLeftWidthFull,
                  },
                  // root: true
                })
              }
            }

            if (rightElements.length < 2) {
              /** 只有一个元素 */
              if (rightFirstElement.style.widthFull) {
                resultRightElement = {
                  ...rightFirstElement,
                  style: {
                    ...rightFirstElement.style,
                    // marginTop: rightFirstElement.style.top - style.top,
                    margin: `${rightFirstElement.style.top - style.top}px ${0}px ${0}px ${0}px`,
                    width: 'auto',
                    flex: rightFlex,
                  }
                }
                if (Array.isArray(rightFirstElement.elements)) {
                  resultRightElement.style.display = "flex";
                  resultRightElement.style.flexDirection = resultRightElement.style.flexDirection;
                  resultRightElement.elements = calculateLayoutRelationship(resultRightElement.elements, {
                    // @ts-ignore
                    style: {// TODO 看看还缺什么，明天继续吧
                      top: style.top, // 这个应该用父元素的top值
                      left: resultRightElement.style.left,
                      width: rightWidth,
                      height: style.height,
                      flexDirection: resultRightElement.style.flexDirection,
                      // @ts-ignore
                      widthFull: hasRightWidthFull,
                    },
                    // root: true
                  })
                }
              } else {
                resultRightElement = {
                  ...rightFirstElement,
                  style: {
                    ...rightFirstElement.style,
                    marginTop: rightFirstElement.style.top - style.top
                  }
                }
                if (Array.isArray(resultRightElement.elements)) {
                  resultRightElement.elements = calculateLayoutRelationship(resultRightElement.elements, {
                    style: resultRightElement.style,
                    // root: true
                  })
                }
              }
            } else {
              /** 多个元素 */
              resultRightElement = {
                id: rightFirstElement.id,
                style: {
                  /** 这里生成的是最终的样式，不再参与计算 */
                  // @ts-ignore
                  display: "flex",
                  flexDirection: style.flexDirection,
                  flex: rightFlex
                },
                elements: calculateLayoutRelationship(rightElements, { // TODO: 这里等会看看 应该要删除right属性的，在计算后
                  // @ts-ignore
                  style: {// TODO 看看还缺什么，明天继续吧
                    top: style.top, // 这个应该用父元素的top值
                    left: rightFirstElement.style.left,
                    width: rightWidth,
                    height: style.height,
                    flexDirection: style.flexDirection,
                    // @ts-ignore
                    widthFull: hasRightWidthFull,
                  },
                  // root: true
                })
              }
            }

            element.elements = [resultLeftElement, resultRightElement];

            finalElements.push({
              id: elements[0].id,
              elements: element.elements,
              style: parentStyle
            })
          }
          /** 设置当前元素距上边距离，用于计算下一个元素的上外间距 */
          currentTop = currentTop + marginTop + style.height;
          return
        } else {
          element.elements = calculateLayoutRelationship(element.elements, {
            // @ts-ignore
            style: element.style,
            // root: true
          })
        }
      }

      const { id, style } = element;
      /** 当前元素上外间距 */
      const marginTop = style.top - currentTop;
      /** 当前元素右外间距 */
      const marginRight = width - (style.left - left) - style.width;

      if (!style.widthFull) {
        /** 当前元素未铺满 */
        if (
          /** 当前元素左侧距容器间距与右侧距容器间距相同时 */
          Math.abs(style.left - left - marginRight) <= 1 && 
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
            finalElements.push({
              ...element,
              id,
              style: {
                marginTop,
                marginLeft: style.left - left, // 不居中要设置左边距
                display: "flex",
                flexDirection: style.flexDirection,
              }
            })
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
                  /** 左距离 单个组件的话不需要设置marginLeft，直接使用flex-end放置在右侧 */
                  // marginLeft: style.left - left,
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
                  marginLeft: style.left - left, // 不居中要设置左边距
                },
              })
            }
          }
        }
      } else {
        /** 当前元素铺满 */
        /** 当前元素左间距 */
        const marginLeft = style.left - left;

        if (style.flexDirection) {
          /** 成组 - 非单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              /** 铺满，即画布拉宽，组件也变宽 */
              width: 'auto',
              margin: `${marginTop}px ${marginRight}px ${0}px ${marginLeft}px`, // 不计算下间距
              display: 'flex',
              flexDirection: style.flexDirection,
            },
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              /** 铺满，即画布拉宽，组件也变宽 */
              width: 'auto',
              height: style.height,
              margin: `${marginTop}px ${marginRight}px ${0}px ${marginLeft}px`, // 不计算下间距
            }
          })
        }
      }

      /** 设置当前元素距上边距离，用于计算下一个元素的上外间距 */
      currentTop = currentTop + marginTop + style.height;
    });
  } else {
    /** 横向排列 - 向右 */
   
    /** 收集 设置 widthFull 的元素具体宽度，计算 flex 比例 */
    const flexXWidths: number[] = [];
    /** 上述数组的index对应的元素位置 elements[index] */
    const flexXIndexToStyleMap = {};
    /** 设置 widthFull 的元素具体宽度合 */
    let flexXSumWidth = 0;
    /** 当前元素元素距左边距离，用于计算子元素的外间距marginLeft */
    let currentLeft = left;

    /** 
     * 将元素从左至右排序
     * 遍历
     */
    elements.sort((preElement, curElement) => preElement.style.left - curElement.style.left).forEach((element, index) => {
      const { id, style } = element;

      if (element.elements) {
        element.elements = calculateLayoutRelationship(element.elements, {
          // @ts-ignore
          style,
          // root: true
        })
      }

      /** 当前元素左外间距 */
      const marginLeft = style.left - currentLeft;
      /** 当前元素上外间距 */
      const marginTop = style.top - top;

      if (!style.widthFull) {
        /** 当前元素未铺满 */
        if (style.flexDirection) {
          /** 成组 - 非单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              marginTop,
              marginLeft,
              display: 'flex',
              flexDirection: style.flexDirection,
            },
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            ...element,
            id: element.id,
            style: {
              width: style.width,
              height: style.height,
              marginTop,
              marginLeft,
            },
          })
        }
      } else {
        /** 当前元素铺满 */

        /** push元素具体宽度 */
        flexXWidths.push(style.width)
        /** 计算总宽度 */
        flexXSumWidth = flexXSumWidth + style.width;
        /** 记录元素位置 */
        flexXIndexToStyleMap[flexXWidths.length - 1] = index;

        if (style.flexDirection) {
          /** 成组 - 非单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              display: 'flex',
              flexDirection: style.flexDirection,
              margin: `${marginTop}px 0px 0px ${marginLeft}px`,
            },
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            ...element,
            id,
            style: {
              /** 不需要宽度，最终会设置flex属性 */
              height: style.height,
              margin: `${marginTop}px 0px 0px ${marginLeft}px`,
            },
          })
        }
      }

      /** 设置当前元素距左边距离，用于计算下一个元素的左外间距 */
      currentLeft = currentLeft + marginLeft + style.width
    })

    if (flexXWidths.length) {
      // 横向可能存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexXWidths)
      flexXWidths.forEach((width, index) => {
        const style = finalElements[flexXIndexToStyleMap[index]].style
        style.flex = width / gcd
        /** 下面两个属性，需要再观察下，后续这类样式设置需要写明原因或遇到的问题 */
        style.overflow = 'hidden'
        style.minWidth = '0px'
      })
    }
  }

  return finalElements;
}
