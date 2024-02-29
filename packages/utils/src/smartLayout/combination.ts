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
  // 先处理包含和相交的关系
  const initElements = handleIntersectionsAndInclusions(sortByTopLeft(elements))
  const finalElements = getCombinationElements(initElements)

  return calculateLayoutData(finalElements, layoutConfig)
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

function calculateLayoutData(elements: Elements, layoutConfig: LayoutConfig) {
  // console.log("开始计算 elements: ", elements.map((e) => e.id))
  const finalElements = []
  const { top, left, width, flexDirection } = layoutConfig.style
  // console.log(0, "容器样式信息: ", layoutConfig.style)
  if (flexDirection === "column") {
    elements.sort((preElement, curElement) => preElement.style.top - curElement.style.top)
    // console.log(1, "👇👇 纵向排列，一行一个组件", elements)
    // 纵向排列，只需要计算纵向
    // 横向需要判断flex布局
    let currentTop = top
    elements.forEach((element) => {
      const { id, style } = element
      const marginTop = style.top - currentTop
      const marginRight = width - (style.left - left) - style.width

      if (!style.flexX) {
        // console.log(1, 1, "没有铺满")
        if (style.left === marginRight) {
          // console.log(1, 1, "居中")
          // 有居中的话，需要多套一层
          if (style.flexDirection) {
            // console.log(1, 1, 1, "成组")
            // 说明是成组了
            finalElements.push({
              id,
              elements: element.elements,
              style: {
                marginTop,
                display: "flex",
                flexDirection: style.flexDirection,
                justifyContent: 'center'
              }
            })
          } else {
            // console.log(1, 1, 2, "单组件")
            // 单个组件
            finalElements.push({
              id,
              elements: [{
                id,
                style: {
                  width: style.width,
                  height: style.height,
                  // 临时
                  // backgroundColor: style.backgroundColor
                }
  
              }],
              style: {
                marginTop,
                display: "flex",
                justifyContent: 'center',
              },
            })
          }
        } else {
          // console.log(1, 2, "不居中")
          // 不居中，不用多套一层，正常设置marginLeft即可
          if (style.flexDirection) {
            // console.log(1, 2, 1, "成组")
            // 说明是成组了
            finalElements.push({
              id,
              elements: element.elements,
              style: {
                marginTop,
                marginLeft: style.left - left,
                display: "flex",
                flexDirection: style.flexDirection,
                // 临时
                // backgroundColor: style.backgroundColor
              }
            })
          } else {
            // console.log(1, 2, 2, "单组件")
            // 单个组件
            finalElements.push({
              id,
              style: {
                width: style.width,
                height: style.height,
                marginTop,
                marginLeft: style.left - left,
                // 临时
                // backgroundColor: style.backgroundColor
              }
            })
          }
        }
      } else {
        // console.log(1, 2, "有铺满")
        const marginLeft = style.left - left
        if (style.flexDirection) {
          // console.log(11111, 2, "成组", element)
          finalElements.push({
            id,
            style: {
              width: 'auto',
              // TODO，是否需要设置最小width？
              // height: style.height,
              margin: `${marginTop}px ${marginRight}px 0px ${marginLeft}px`,
              display: 'flex',
              flexDirection: style.flexDirection,
              // 临时
              // backgroundColor: style.backgroundColor
            },
            elements: element.elements
          })
        } else {
          // console.log(1, 3, "单组件")
          
          finalElements.push({
            id,
            style: {
              width: 'auto',
              // TODO，是否需要设置最小width？
              height: style.height,
              margin: `${marginTop}px ${marginRight}px 0px ${marginLeft}px`,
              // 临时
              // backgroundColor: style.backgroundColor
            }
          })
        }
      }



      currentTop = currentTop + marginTop + style.height
    })
  } else {
    elements.sort((preElement, curElement) => preElement.style.left - curElement.style.left)
    // 设置了宽度百分百的宽度数组
    const flexXWidths = []
    // 上述数组的index对应com的style
    const flexXIndexToStyleMap = {}
    // 设置宽度百分百的com的总宽度
    let flexXSumWidth = 0


    // console.log(2, "👉👉 横向排列，一行多个组件", elements)
    // 横向排列，只需要计算横向
    let currentLeft = left

    elements.forEach((element, index) => {
      const { id, style } = element
      const marginLeft = style.left - currentLeft
      const marginTop = style.top - top

      if (!style.flexX) {
        // console.log(11)
        if (style.flexDirection) {
          // console.log(2, 1, "成组")
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
          // console.log(2, 2, "单个组件", element)
          finalElements.push({
            id: element.id,
            style: {
              width: style.width,
              height: style.height,
              marginTop,
              marginLeft,
              // 临时
              // backgroundColor: style.backgroundColor
            }
          })
        }
      } else {
        // console.log(22)
        flexXWidths.push(style.width)
        flexXSumWidth = flexXSumWidth + style.width
        flexXIndexToStyleMap[flexXWidths.length - 1] = index
  
        if (style.flexDirection) {
          // console.log(33, element, "横向铺满 成组")
          // debugger
          finalElements.push({
            id,
            style: {
              display: 'flex',
              flexDirection: style.flexDirection,
              // height: style.height,
              margin: `${marginTop}px 0px 0px ${marginLeft}px`,
            },
            elements: element.elements
          })
        } else {
          // console.log(44, element, "横向铺满 单组件")
          finalElements.push({
            id,
            style: {
              // width: 'auto',
              // flexX: 1,
              // width: style.width,
              // TODO，是否需要设置最小width？
              height: style.height,
              margin: `${marginTop}px 0px 0px ${marginLeft}px`,
              // 临时
              // backgroundColor: style.backgroundColor
            }
          })
        }
      }
      currentLeft = currentLeft + marginLeft + element.style.width
    })


    if (flexXWidths.length) {
      // 横向可能存在多个铺满组件，需要计算flex值
      const gcd = findGCD(flexXWidths)
      // console.log("gcd: ", gcd)
      flexXWidths.forEach((width, index) => {
        // const style = flexXIndexToStyleMap[index]
        const style = finalElements[flexXIndexToStyleMap[index]].style
        style.flex = width / gcd
      })
    }
  }

  // console.log("计算结果: ", finalElements.map((element, index) => {
  //   return {
  //     ...element,
  //     tempStyle: elements[index].style
  //   }
  // }))

  return finalElements.map((element, index) => {
    return {
      ...element,
      tempStyle: elements[index].style
    }
  })
}

/**
 * 获取分组结果
 */
function getCombinationElements(elements: Elements) {
  // 计算元素的相邻关系
  const elementIdToAdjacency = getElementAdjacency(elements)
  // console.log("elements: ", elements.map(e => e.id))
  // console.log("elementIdToAdjacency: ", elementIdToAdjacency)

  // if (elementIdToAdjacency['A,F,B,G,L,O,Q,R,C,H,M,P,D,I,N']) {
  //   console.log("elements: ", elements.map(e => e.id))
  //   console.log("elementIdToAdjacency: ", elementIdToAdjacency)
  // }

  // 拆分结果
  let combinationElements = []
  // 通过元素ID查询当前位置信息
  const elementIdToPosition = {}

  elements.forEach((element) => {
    const elementID = element.id
    const elementAdjacency = elementIdToAdjacency[elementID]
    const {
      // top,
      // right,
      // bottom,
      // left,
      min,
      // spaceSort,
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
      // if (min.element.flexX || element.flexX) {
      //   console.log("❌❌❌ 看情况是否需要做合并")
      // } else {
      //   console.log("✅ 不参与分组")
      //   combinationElements.push(element)
      // }
    } else {
      if (!elementIdToPosition[elementID] && !elementIdToPosition[min.element.id] && !elementIdToAdjacency[min.element.id].single) {
        if (elementID === elementIdToAdjacency[min.element.id].min.element.id) {
          // console.log(`元素${elementID}的最小相邻元素: `, elementID, min.element.id, elementIdToAdjacency[min.element.id].min.element.id)
          // console.log("合并: ", [element.id, min.element.id])

          // if (element.id === 'C,H,M,P,D,I,N' && min.element.id === 'E,J,S,K,T') {
          //   console.log("合并: ", [element.id, min.element.id])
          //   console.log("elementIdToAdjacency: ", elementIdToAdjacency)
          // }

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

      // for (let i = 0; i < spaceSort.length; i++) {
      //   const directionAdjacency = spaceSort[i]
      //   const direction = directionAdjacency.direction

      //   if (directionAdjacency.intersect) {
      //     continue
      //   }

      //   const comparedElementAdjacency = elementIdToAdjacency[directionAdjacency.element.id]

      //   if (direction === 'right') {
      //     // 被对比元素最小是left就可以
      //     if (comparedElementAdjacency.min && !comparedElementAdjacency.min.intersect && comparedElementAdjacency.min.direction === 'left' && !comparedElementAdjacency.single && !elementIdToPosition[elementID]) {
      //       // console.log(111, "合并", [elementID, directionAdjacency.element.id])
      //       const comparedElementPosition = elementIdToPosition[directionAdjacency.element.id]
      //       const space = comparedElementAdjacency.min.space
      //       if (!comparedElementPosition) {
      //         // 被对比的没有，直接合并
      //         combinationElements.push([element, directionAdjacency.element])
      //         const idx1 = combinationElements.length - 1
      //         elementIdToPosition[elementID] = {
      //           idx1,
      //           idx2: 0,
      //           space
      //         }
      //         elementIdToPosition[directionAdjacency.element.id] = {
      //           idx1,
      //           idx2: 1,
      //           space
      //         }
      //         break
      //       } else {
      //         // 有被对比的，需要对比space
      //         if (comparedElementPosition.space > space) {
      //           // 当前的更小，替换
      //           // 删除原来被对比的
      //           const [element0, element1] =  combinationElements[comparedElementPosition.idx1]
      //           Reflect.deleteProperty(elementIdToPosition, element0.id)
      //           Reflect.deleteProperty(elementIdToPosition, element1.id)
      //           combinationElements[comparedElementPosition.idx1] = null
      //           combinationElements.push([element, directionAdjacency.element])
      //           const idx1 = combinationElements.length - 1
      //           elementIdToPosition[elementID] = {
      //             idx1,
      //             idx2: 0,
      //             space
      //           }
      //           elementIdToPosition[directionAdjacency.element.id] = {
      //             idx1,
      //             idx2: 1,
      //             space
      //           }
      //           break
      //         }
      //       }
      //     }
      //   } else if (direction === 'bottom') {
      //     // 被对比元素最小是top就可以
      //     if (comparedElementAdjacency.min && !comparedElementAdjacency.min.intersect && comparedElementAdjacency.min.direction === 'top' && !comparedElementAdjacency.single && !elementIdToPosition[elementID]) {
      //       // console.log(222, "合并", [elementID, directionAdjacency.element.id])
      //       const comparedElementPosition = elementIdToPosition[directionAdjacency.element.id]
      //       const space = comparedElementAdjacency.min.space

      //       if (!comparedElementPosition) {
      //         // 被对比的没有，直接合并
      //         combinationElements.push([element, directionAdjacency.element])
      //         const idx1 = combinationElements.length - 1
      //         elementIdToPosition[elementID] = {
      //           idx1,
      //           idx2: 0,
      //           space
      //         }
      //         elementIdToPosition[directionAdjacency.element.id] = {
      //           idx1,
      //           idx2: 1,
      //           space
      //         }
      //         break
      //       } else {
      //         // 有被对比的，需要对比space
      //         if (comparedElementPosition.space > space) {
      //           // 当前的更小，替换
      //           // 删除原来被对比的
      //           const [element0, element1] =  combinationElements[comparedElementPosition.idx1]
      //           Reflect.deleteProperty(elementIdToPosition, element0.id)
      //           Reflect.deleteProperty(elementIdToPosition, element1.id)
      //           combinationElements[comparedElementPosition.idx1] = null
      //           combinationElements.push([element, directionAdjacency.element])
      //           const idx1 = combinationElements.length - 1
      //           elementIdToPosition[elementID] = {
      //             idx1,
      //             idx2: 0,
      //             space
      //           }
      //           elementIdToPosition[directionAdjacency.element.id] = {
      //             idx1,
      //             idx2: 1,
      //             space
      //           }
      //           break
      //         }
      //       }
      //     }
      //   }
      // }
    }
  })

  combinationElements = combinationElements.filter((c) => c)

  elements.forEach((element) => {
    if (!elementIdToPosition[element.id]) {
      combinationElements.push(element)
    }
  })

  // console.log("🔥 分组结果: ", combinationElements.map((e) => {
  //   if (Array.isArray(e)) {
  //     return e.map((e) => e.id)
  //   }
  //   return e?.id
  // }))

  if (elements.length !== combinationElements.length) {
    return getCombinationElements(sortByTopLeft(convertedToElements(combinationElements)))
  }

  return convertedToElements(sortByTopLeft(combinationElements))
}

/**
 * 将分组元素数组转换为新的元素
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
      // console.log(1, "当前方向: ", flexDirection)
      // console.log(2, "ele0方向: ", element0FlexDirection, element0)
      // console.log(3, "ele1方向: ", element1FlexDirection, element1)
      // console.log(4, "是否合并: ", !!((element0FlexDirection || element1FlexDirection) && (element1FlexDirection === flexDirection)) )
      // console.log(5, "当前计算的内容: ", (element0FlexDirection || element1FlexDirection) && element1FlexDirection === flexDirection ? [element0, ...element1.elements].map((element) => ({...element, style: element.tempStyle || element.style})) : element)

      let calculateElements = element
      if (!element0FlexDirection && !element1FlexDirection) {

      } else {
        if (element0FlexDirection === flexDirection) {
          calculateElements = [...element0.elements, element1].map((element) => ({...element, style: element.tempStyle || element.style}))
        } else if (element1FlexDirection === flexDirection) {
          calculateElements = [element0, ...element1.elements].map((element) => ({...element, style: element.tempStyle || element.style}))
        }
      }

      
      convertedElements.push({
        // 临时
        // id: `${element0.id},${element1.id}`,
        id: element0.id,
        style: {
          top,
          left,
          width,
          height,
          flexDirection,
          flexX: element.find((element) => element.style.flexX) ? 1 : null
        },
        // elements: calculateLayoutData(element, { style: { width, flexDirection, top, left } })
        elements: calculateLayoutData(calculateElements, { style: { width, flexDirection, top, left } })
      })
    } else {
      // 直接push
      convertedElements.push(element)
    }
  })

  return convertedElements
}

/**
 * TODO:
 * 处理包含和相交关系
 */
function handleIntersectionsAndInclusions(elements: Elements) {
  return elements
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
    // 最小的相邻元素，不包含上
    // const min = [right, bottom, left, top].reduce((pre, cur) => {
    //   if (!pre && !cur) {
    //     return
    //   } else if (pre && cur) {
    //     if (pre.space > cur.space) {
    //       return cur
    //     }
    //     return pre
    //   } else {
    //     return pre || cur
    //   }
    // })
    
    elementIdToAdjacency[key] = {
      top,
      left,
      right,
      bottom,
      single: !left && !right,
      // min,
      // spaceSort: [right, bottom].filter((direction) => direction).sort((pre, cur) => {
      //   return pre.space - cur.space
      // })
      spaceSort: []
    }



    // const top = checkTopIntersects(value.topElements, currentElement)
    // const right = checkRightIntersects(value.rightElements, currentElement)
    // const bottom = checkBottomIntersects(value.bottomElements, currentElement)
    // const left = checkLeftIntersects(value.leftElements, currentElement)
    // // 最小的相邻元素
    // const min = [top, right, bottom, left].reduce((pre, cur) => {
    //   if (!pre && !cur) {
    //     return
    //   } else if (pre && cur) {
    //     if (pre.space > cur.space) {
    //       return cur
    //     }
    //     return pre
    //   } else {
    //     return pre || cur
    //   }
    // })
    
    // elementIdToAdjacency[key] = {
    //   right,
    //   bottom,
    //   top,
    //   left,
    //   min,
    //   spaceSort: [right, bottom, left, top].filter((direction) => direction).sort((pre, cur) => {
    //     return pre.space - cur.space
    //   })
    // }
  })

  Object.entries(elementIdToAdjacency).forEach(([key, value]) => {
    // value.single = !value.left && !value.right

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
      
      

      // if (preDirection.intersect) {
      //   // 说明相交就是null
      // } else {
      //   const preComparedElement = preDirection.element
      // }

      // const pre = !preDirection?.intersect ? preDirection : null
      // const cur = !curDirection?.intersect ? curDirection : null

      // const pre = preDirection
      // const cur = curDirection

      // haslog && console.log("hello: ", {pre, cur})
      // haslog && console.log("world: ", value)
      // haslog && console.log("elementIdToAdjacency: ", elementIdToAdjacency[pre.element.id])
      
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

    // value.spaceSort = [value.right, value.bottom].filter((direction) => direction).sort((pre, cur) => {
    //   return pre.space - cur.space
    // })
  })

  return elementIdToAdjacency
}

/**
 * 右侧是否相交
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
 * 下侧是否相交
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
 * 上侧是否相交
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
 * 左侧是否相交
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
 * 从上至下，从左至右排序
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