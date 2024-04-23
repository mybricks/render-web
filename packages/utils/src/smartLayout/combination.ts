import type { Element, Elements, DefaultLayoutConfig as LayoutConfig } from './'

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
export default function combination(elements: Elements, layoutConfig: LayoutConfig) {
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
                root: true
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
                    root: true
                  })
                  console.log("resultLeftElement.elements 结果", resultLeftElement.elements)
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
                    root: true
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
                  root: true
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
                    root: true
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
                    root: true
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
                  root: true
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
          return
        } else {
          element.elements = calculateLayoutRelationship(element.elements, {
            // @ts-ignore
            style: element.style,
            root: true
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
            /** 成组 - 非单组件 */
            finalElements.push({
              id,
              elements: element.elements, // TODO: 是不是要继续计算？
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
                id,
                style: {
                  /** 记录当前元素宽高，可能还要继续计算的 */
                  width: style.width,
                  height: style.height,
                },
                brother: element.brother, // 单组件才有相交节点，分组生成的不会有
                child: element.child
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
              id,
              elements: element.elements,
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
            if (style.right) {
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
                  id,
                  style: {
                    // 组件样式
                    width: style.width,
                    height: style.height,
                  },
                  brother: element.brother, // 单组件才有相交节点，分组生成的不会有
                  child: element.child
                }]
              })
            } else {
              /**
               * 单组件非居右
               * 正常计算
              */
              finalElements.push({
                id,
                style: {
                  width: style.width,
                  height: style.height,
                  marginTop,
                  marginLeft: style.left - left, // 不居中要设置左边距
                },
                brother: element.brother, // 单组件才有相交节点，分组生成的不会有
                child: element.child
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
            id,
            style: {
              /** 铺满，即画布拉宽，组件也变宽 */
              width: 'auto',
              margin: `${marginTop}px ${marginRight}px ${0}px ${marginLeft}px`, // 不计算下间距
              display: 'flex',
              flexDirection: style.flexDirection,
            },
            elements: element.elements
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            id,
            style: {
              /** 铺满，即画布拉宽，组件也变宽 */
              width: 'auto',
              height: style.height,
              margin: `${marginTop}px ${marginRight}px ${0}px ${marginLeft}px`, // 不计算下间距
            },
            brother: element.brother, // 单组件才有相交节点，分组生成的不会有
            child: element.child
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
          root: true
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
            id,
            style: {
              marginTop,
              marginLeft,
              display: 'flex',
              flexDirection: style.flexDirection,
            },
            elements: element.elements,
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            id: element.id,
            style: {
              width: style.width,
              height: style.height,
              marginTop,
              marginLeft,
            },
            brother: element.brother, // 单组件才有相交节点，分组生成的不会有
            child: element.child
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
            id,
            style: {
              display: 'flex',
              flexDirection: style.flexDirection,
              margin: `${marginTop}px 0px 0px ${marginLeft}px`,
            },
            elements: element.elements
          })
        } else {
          /** 未成组 - 单组件 */
          finalElements.push({
            id,
            style: {
              /** 不需要宽度，最终会设置flex属性 */
              height: style.height,
              margin: `${marginTop}px 0px 0px ${marginLeft}px`,
            },
            brother: element.brother, // 单组件才有相交节点，分组生成的不会有
            child: element.child
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

/**
 * 基于规则的分组
 */
function getCombinationElements(elements: Elements) {
  const elementIdToAdjacency = getElementAdjacency(elements)
  /** 通过元素ID查询当前位置信息 */
  const elementIdToPosition = {}
  // 拆分结果
  let combinationElements = []
  
  elements.forEach((element) => {
    const elementID = element.id
    const elementAdjacency = elementIdToAdjacency[elementID]
    const {
      min,
      single
    } = elementAdjacency

    if (!min) { // !spaceSort.length
      combinationElements.push(element)
      elementIdToPosition[elementID] = {
        idx1: combinationElements.length - 1,
        idx2: null // 非数字代表单独一个，不参与分组
      }
      return
    }

    /**
     * 过程中可能的TODO，如果两个组件被声明为一组，那就要参与计算了，比如，上下两个组件是水平居中的
     * 目前非一组的两个组件，都是单个的
     */

    if (single) {
      // console.log("❌❌ 不参与分组, 这里还要判断flexX的问题，如果自身或下面有flexX，看是有居中", elementID)
      combinationElements.push(element)
      elementIdToPosition[elementID] = {
        idx1: combinationElements.length - 1,
        idx2: null // 非数字代表单独一个，不参与分组
      }
    } else {
      if (!elementIdToPosition[elementID] && !elementIdToPosition[min.element.id] && !elementIdToAdjacency[min.element.id].single) {
        if (elementID === elementIdToAdjacency[min.element.id].min.element.id) {
          // console.log(`元素${elementID}的最小相邻元素: `, elementID, min.element.id, elementIdToAdjacency[min.element.id].min.element.id)
          combinationElements.push([element, min.element])
          const idx1 = combinationElements.length - 1
          elementIdToPosition[elementID] = {
            idx1,
            idx2: 0
          }
          elementIdToPosition[min.element.id] = {
            idx1,
            idx2: 1,
          }
        }
      }
    }
  })

  combinationElements = combinationElements.filter((c) => c)

  elements.forEach((element) => {
    if (!elementIdToPosition[element.id]) {
      combinationElements.push(element)
    }
  })

  if (elements.length !== combinationElements.length) {
    return getCombinationElements(sortByTopLeft(convertedToElements(combinationElements)))
  }

  return convertedToElements(sortByTopLeft(combinationElements))
}

/**
 * 将分组元素数组转换为新的元素
 * 这里其实就是合并相同方向的元素
 */
function convertedToElements(elements: Array<Element | Elements>) {
  const convertedElements = []

  elements.forEach((element) => {
    if (Array.isArray(element)) {
      const [element0, element1] = element
      const left = Math.min(element0.style.left, element1.style.left)
      const top = Math.min(element0.style.top, element1.style.top)
      const width = Math.max(element0.style.left + element0.style.width - left, element1.style.left + element1.style.width - left)
      const height = Math.max(element0.style.top + element0.style.height - top, element1.style.top + element1.style.height - top)
      const flexDirection = height >= element0.style.height + element1.style.height ? "column" : "row"
      const element0FlexDirection = element0.style.flexDirection
      const element1FlexDirection = element1.style.flexDirection
      let calculateElements = element

      if (!element0FlexDirection && !element1FlexDirection) {

      } else {
        /** 合并相同方向的元素 */
        // if (element0FlexDirection === flexDirection) {
        //   calculateElements = [...element0.elements, element1].map((element) => ({...element, style: element.tempStyle || element.style}))
        // } else if (element1FlexDirection === flexDirection) {
        //   calculateElements = [element0, ...element1.elements].map((element) => ({...element, style: element.tempStyle || element.style}))
        // }
        if (element0FlexDirection === flexDirection) {
          if (element0FlexDirection === element1FlexDirection) {
            calculateElements = [...element0.elements, ...(element1.elements ? element1.elements : [element1])].map((element) => ({...element, style: element.tempStyle || element.style}))
          } else {
            calculateElements = [...element0.elements, element1].map((element) => ({...element, style: element.tempStyle || element.style}))
          }
        } else if (element1FlexDirection === flexDirection) {
          if (element1FlexDirection === element0FlexDirection) {
            calculateElements = [...(element0.elements ? element0.elements : [element0]), ...element1.elements].map((element) => ({...element, style: element.tempStyle || element.style}))
          } else {
            calculateElements = [element0, ...element1.elements].map((element) => ({...element, style: element.tempStyle || element.style}))
          }
        }
      }

      /** 父元素样式 */
      const parentStyle: any = {
        top,
        left,
        width,
        height,
        flexDirection,
        widthFull: element.find((element) => element.style.widthFull) ? 1 : null,
        isNotAutoGroup: false
      }

      // 如果是纵向合并
      if (flexDirection === "column") {
        // 全部居右的话，认为是居右的
        if (calculateElements.filter(e => e.style.right).length === calculateElements.length) {
          const minRight = calculateElements.slice(1).reduce((p, c) => {
            return c.style.right > p ? p : c.style.right;
          }, calculateElements[0].style.right);
  
          parentStyle.right = minRight;
        }
        // 如果是纵向排列的话，将居右删除
        calculateElements.forEach((e) => {
          Reflect.deleteProperty(e.style, "right");
        })
      }

      convertedElements.push({
        id: element0.id,
        style: parentStyle,
        // elements: calculateLayoutData(calculateElements, { style: { width, flexDirection, top, left, height }, root: true, isNotAutoGroup: false })
        elements: calculateElements
      })
    } else {
      // 直接push
      convertedElements.push(element)
    }
  })

  return convertedElements
}

/**
 * 处理相交关系
 * TODO:
 * 实现较临时，改天重构下
 *  - 只有相交
 */
function handleIntersectionsAndInclusions(elements: Elements) {
  /** id对应element */
  const idToElementMap = {};
  /** 已经成为brother的id */
  const isBrotherIdsMap = {};
  const brotherToIdMap = {}
  /** 已经成为children的id */
  const isChildrenIdsMap = {};
  const childrenToIdMap = {}
  

  /** 最终的元素列表 */
  let newElements = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const elementStyle = element.style;
    if (!idToElementMap[element.id]) {
      idToElementMap[element.id] = {
        ...element,
        brother: [],
        children: []
      }
    }
    for (let j = i + 1; j < elements.length; j++) {
      const nextElement = elements[j];
      const nextElementStyle = nextElement.style;
      if (!idToElementMap[nextElement.id]) {
        idToElementMap[nextElement.id] = {
          ...nextElement,
          brother: [],
          children: []
        }
      }

      if (
        (nextElementStyle.left >= elementStyle.left + elementStyle.width) && 
        (nextElementStyle.top >= elementStyle.top + elementStyle.height)) {
          /** 已经在右下角了，直接退出即可 */
          break
      }

      const elementRelation = getElementRelation(elementStyle, nextElementStyle)

      if (elementRelation) {
        if (elementRelation === "include") {
          /** 包含，是children */
          childrenToIdMap[nextElement.id] = element.id;
          idToElementMap[element.id].children.push(idToElementMap[nextElement.id]);
          isChildrenIdsMap[nextElement.id] = {
            index: j
          }
        } else {
          /** 相交，是brother */
          brotherToIdMap[nextElement.id] = element.id;
          idToElementMap[element.id].brother.push(idToElementMap[nextElement.id])
          isBrotherIdsMap[nextElement.id] = {
            index: j
          };
        }
      }
    }

    newElements.push(idToElementMap[element.id])
  }

  Object.entries(isBrotherIdsMap).forEach(([key, value]: any) => {
    newElements[value.index] = null;
  })
  Object.entries(isChildrenIdsMap).forEach(([key, value]: any) => {
    newElements[value.index] = null;
  })

  const finalElements = newElements.filter((element) => {
    if (element) {
      deepBrother(element)
      const { style, children } = element

      if (children.length) {
        element.children = combination(children.map((child) => {
          return {
            ...child,
            style: {
              ...child.style,
              top: child.style.top - style.top,
              left: child.style.left - style.left,
              right: (style.left + style.width) - (child.style.left + child.style.width),
              // bottom: 1
            }
          }
        }), {
          style: {
            width: style.width,
            height: style.height,
            isNotAutoGroup: true,
            top: 0,
            left: 0,
            flexDirection: "column"
          },
          root: true
        });

        element.child = {
          id: element.children[0].id,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: "100%",
            height: "100%"
          },
          elements: element.children
        }

        Reflect.deleteProperty(element, "children")
      }
    }
    return element
  })

  function deepBrother(element) {
    const { id, style } = element
    element.brother = element.brother.filter(({id: brotherId, style: brotherStyle, brother}) => {
      let bool = brotherToIdMap[brotherId] === id
      if (bool) {
        deepBrother({id: brotherId, style: brotherStyle, brother})
        brotherStyle.position = 'absolute';

        brotherStyle.top = brotherStyle.top - style.top
        brotherStyle.left = brotherStyle.left - style.left
      }
      return bool
    })
  }

  return finalElements
}

function getElementRelation({width: widthA, height: heightA, top: topA, left: leftA}, {width: widthB, height: heightB, top: topB, left: leftB}) {
  const rightA = leftA + widthA;
  const bottomA = topA + heightA;
  const rightB = leftB + widthB;
  const bottomB = topB + heightB;

  // intersect 相交
  // include 包含

  if (rightA <= leftB || leftA >= rightB || bottomA <= topB || topA >= bottomB) {
    return false; // 两个矩形不相交、也就不可能包含
  } else {
    if (
      /** 被对比元素左侧大于对比元素 */
      leftB >= leftA &&
      /** 被对比元素上册大于对比元素 */
      topB >= topA &&
      /** 被对比元素右侧大于对比元素 */
      rightA >= rightB &&
      /** 被对比元素下侧大于对于元素 */
      bottomA >= bottomB
    ) {
      /** 说明是包含 */
      return "include";
    }

    return "intersect";
  }
}

/** 检查元素是否相交 */
function isIntersecting({width: widthA, height: heightA, top: topA, left: leftA}, {width: widthB, height: heightB, top: topB, left: leftB}) {
  const rightA = leftA + widthA;
  const bottomA = topA + heightA;
  const rightB = leftB + widthB;
  const bottomB = topB + heightB;

  if (rightA <= leftB || leftA >= rightB || bottomA <= topB || topA >= bottomB) {
      return false; // 两个矩形不相交
  } else {
      return true; // 两个矩形相交
  }
}


interface Adjacency {
  element: Element
  space: number
  intersect: boolean
  direction: "top" | "right" | "bottom" | "left" | string
}

/**
 * 相邻元素信息
 */
type ElementIdToAdjacency = {
  [key: string]: {
    // [key in "top" | "right" | "bottom" | "left" | "min"]?: Adjacency;
    top?: Adjacency
    right?: Adjacency
    bottom?: Adjacency
    left?: Adjacency
    min?: Adjacency
    spaceSort: Adjacency[] // 间距判断（从小到大，只有right、bottom）
    single?: boolean // 是否单独一行
  }
}

/**
 * 反方向对应map
 */
const REVERSE_DIRECTION_MAP = {
  "top": "bottom",
  "bottom": "top",
  "left": "right",
  "right": "left"
}

/**
 * 获取元素相邻关系
 */
export function getElementAdjacency(elements: Elements) {
  const elementIdToAdjacency: ElementIdToAdjacency = {}
  const tempElementIdToAdjacency: {
    [key: string]: {
      topElements:Elements
      leftElements:Elements
      rightElements:Elements
      bottomElements:Elements
    }
  } = {}
  const elementIdToElementMap = {}
  const elementsLength = elements.length

  elements.forEach((element) => {
    elementIdToElementMap[element.id] = element
    let elementAdjacency = tempElementIdToAdjacency[element.id]
    if (!elementAdjacency) {
      // 初始化相邻信息
      elementAdjacency = tempElementIdToAdjacency[element.id] = {
        topElements: [],
        leftElements: [],
        rightElements: [],
        bottomElements: [],
      }
    }
    for (let i = 0; i < elementsLength; i++) {
      const comparedElement = elements[i]

      if (element.id === comparedElement.id) {
        // 相同元素，直接跳过
        continue
      }

      if ((comparedElement.style.left + comparedElement.style.width) <= element.style.left && (comparedElement.style.top + comparedElement.style.height) <= element.style.top) {
        // console.log("✅ 被对比元素在当前元素的左上方，跳过对比", `${comparedElement.id} => ${element.id}`)
        continue
      }

      if ((comparedElement.style.top + comparedElement.style.height) <= element.style.top && (element.style.left + element.style.width) <= comparedElement.style.left) {
        // console.log("✅ 被对比元素在当前元素的右上方，跳过对比", `${comparedElement.id} => ${element.id}`)
        continue
      }

      if (comparedElement.style.top >= (element.style.top + element.style.height) && (comparedElement.style.left + comparedElement.style.width) <= element.style.left) {
        // console.log("✅ 被对比元素在当前元素的左下方，跳过对比", `${comparedElement.id} => ${element.id}`)
        continue
      }

      if (comparedElement.style.left >= (element.style.left + element.style.width) && comparedElement.style.top >= (element.style.top + element.style.height)) {
        // console.log("✅ 被对比元素在当前元素的右下方，直接结束，不需要再向后遍历了", `${comparedElement.id} => ${element.id}`)
        continue
      }

      if (comparedElement.style.top >= element.style.top + element.style.height) {
        // console.log(`✅ 被对比元素 ${comparedElement.id} 在当前元素 ${element.id} 下侧 👇👇👇👇`)
        elementAdjacency.bottomElements.push(comparedElement)
      } else if (comparedElement.style.top + comparedElement.style.height <= element.style.top) {
        // console.log(`✅ 被对比元素 ${comparedElement.id} 在当前元素 ${element.id} 上侧 👆👆👆👆`)
        elementAdjacency.topElements.push(comparedElement)
      } else if (comparedElement.style.left >= element.style.left + element.style.width) {
        // console.log(`✅ 被对比元素 ${comparedElement.id} 在当前元素 ${element.id} 右侧 👉👉👉👉`)
        elementAdjacency.rightElements.push(comparedElement)
      } else if (comparedElement.style.left + comparedElement.style.width <= element.style.left) {
        // console.log(`✅ 被对比元素 ${comparedElement.id} 在当前元素 ${element.id} 左侧 👈👈👈👈`)
        elementAdjacency.leftElements.push(comparedElement)
      }
    }
  })

  Object.entries(tempElementIdToAdjacency).forEach(([key, value]) => {
    const currentElement = elementIdToElementMap[key]
    const top = checkTopIntersects(value.topElements, currentElement)
    const right = checkRightIntersects(value.rightElements, currentElement)
    const bottom = checkBottomIntersects(value.bottomElements, currentElement)
    const left = checkLeftIntersects(value.leftElements, currentElement)
    
    elementIdToAdjacency[key] = {
      top,
      left,
      right,
      bottom,
      single: !left && !right,
      spaceSort: []
    }
  })

  Object.entries(elementIdToAdjacency).forEach(([key, value]) => {
    // 被对比的反方向不是的话，就去除
    if (value.bottom) {
      const comparedElementAdjacency = elementIdToAdjacency[value.bottom.element.id]
      if (!comparedElementAdjacency.top || comparedElementAdjacency.top.element.id !== key) {
        value.bottom = null
      }
    }
    if (value.top) {
      const comparedElementAdjacency = elementIdToAdjacency[value.top.element.id]
      if (!comparedElementAdjacency.bottom || comparedElementAdjacency.bottom.element.id !== key) {
        value.top = null
      }
    }
    if (value.left) {
      const comparedElementAdjacency = elementIdToAdjacency[value.left.element.id]
      if (!comparedElementAdjacency.right || comparedElementAdjacency.right.element.id !== key) {
        value.left = null
      }
    }
    if (value.right) {
      const comparedElementAdjacency = elementIdToAdjacency[value.right.element.id]
      if (!comparedElementAdjacency.left || comparedElementAdjacency.left.element.id !== key) {
        value.right = null
      }
    }

    const min = [value.right, value.bottom, value.left, value.top].reduce((preDirection, curDirection) => {
      let pre, cur

      const preComparedElement = elementIdToAdjacency[preDirection?.element.id]
      if (preComparedElement && !preDirection.intersect && !preComparedElement.single) {
        // 首先有pre且对比方向上不能相交
        const comparedDirection = preComparedElement[REVERSE_DIRECTION_MAP[preDirection.direction]] as Adjacency

        if (!comparedDirection.intersect) {
          pre = preDirection
        }
      }

      const curComparedElement = elementIdToAdjacency[curDirection?.element.id]
      if (curComparedElement && !curDirection.intersect && !curComparedElement.single) {
        // 首先有pre且对比方向上不能相交
        const comparedDirection = curComparedElement[REVERSE_DIRECTION_MAP[curDirection.direction]] as Adjacency

        if (!comparedDirection.intersect) {
          cur = curDirection
        }
      }
      
      if (!pre && !cur) {
        return
      } else if (pre && cur) {
        if (pre.space > cur.space) {
          return cur
        }
        return pre
      } else {

        return pre || cur
      }
    })

    value.min = min
  })

  return elementIdToAdjacency
}

/**
 * 右侧投影是否相交
 */
function checkRightIntersects(elements: Elements, element: Element) {
  const length = elements.length
  let rightElement, rightSpace, rightIntersect

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      rightElement = currentElement
      rightSpace = currentElement.style.left - (element.style.left + element.style.width)
    }
    rightIntersect = false
  } else {
    elements.sort((pre, cur) => {
      return pre.style.left - cur.style.left
    })
    const element1 = elements[0]
    const element2 = elements[1]

    rightElement = element1
    rightSpace = element1.style.left - (element.style.left + element.style.width)

    if (element1.style.left + element1.style.width > element2.style.left) {
      rightIntersect = true
    } else {
      rightIntersect = false
    }
  }

  return rightElement ? { element: rightElement, space: rightSpace, intersect: rightIntersect, direction: 'right' } : null
}

 /**
 * 下侧投影是否相交
 */
function checkBottomIntersects(elements: Elements, element: Element) {
  const length = elements.length

  let bottomElement, bottomSpace, bottomIntersect

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      bottomElement = currentElement
      bottomSpace = currentElement.style.top - (element.style.top + element.style.height)
    }
    bottomIntersect = false
  } else {
    elements.sort((pre, cur) => {
      return pre.style.top - cur.style.top
    })
    const element1 = elements[0]
    const element2 = elements[1]

    bottomElement = element1
    bottomSpace = element1.style.top - (element.style.top + element.style.height)

    if (element1.style.top + element1.style.height > element2.style.top) {
      bottomIntersect = true
    } else {
      bottomIntersect = false
    }
  }

  return bottomElement ? { element: bottomElement, space: bottomSpace, intersect: bottomIntersect, direction: 'bottom' } : null
}

/**
 * 上侧投影是否相交
 */
function checkTopIntersects(elements: Elements, element: Element) {
  const length = elements.length

  let topElement, topSpace, topIntersect

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      topElement = currentElement
      topSpace = element.style.top - (currentElement.style.top + currentElement.style.height)
    }
    topIntersect = false
  } else {
    elements.sort((pre, cur) => {
      return  (cur.style.top + cur.style.height) - (pre.style.top + pre.style.height)
    })
    const element1 = elements[0]
    const element2 = elements[1]

    topElement = element1
    topSpace = element.style.top - (element1.style.top + element1.style.height)

    if (element2.style.top + element2.style.height > element1.style.top) {
      topIntersect = true
    } else {
      topIntersect = false
    }
  }

  return topElement ? { element: topElement, space: topSpace, intersect: topIntersect, direction: 'top' } : null
}

/**
 * 左侧投影是否相交
 */
function checkLeftIntersects(elements: Elements, element: Element) {
  const length = elements.length

  let leftElement, leftSpace, leftIntersect

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      leftElement = currentElement
      leftSpace = element.style.left - (currentElement.style.left + currentElement.style.width)
    }
    leftIntersect = false
  } else {
    elements.sort((pre, cur) => {
      return (cur.style.left + cur.style.width) - (pre.style.left + pre.style.width)
    })
    const element1 = elements[0]
    const element2 = elements[1]

    leftElement = element1
    leftSpace = element.style.left - (element1.style.left + element1.style.width)

    if (element2.style.left + element2.style.width > element1.style.left) {
      leftIntersect = true
    } else {
      leftIntersect = false
    }
  }

  return leftElement ? { element: leftElement, space: leftSpace, intersect: leftIntersect, direction: 'left' } : null
}

/**
 * 对元素拍素，从上至下，从左至右
 */
function sortByTopLeft(elements: Elements) {
  return elements.sort((pre, cur) => {
    const preStyle = pre.style
    const curStyle = cur.style
    if (preStyle.top === curStyle.top) {
      return preStyle.left - curStyle.left
    }
    return preStyle.top - curStyle.top
  })
}
