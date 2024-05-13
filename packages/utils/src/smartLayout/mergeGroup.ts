import { sortByTopLeft } from "./sort";
import { getElementAdjacency } from "./relation"

import type { Elements, Element } from "."

import { ps, log } from "./combination"
import { isNumber } from "../type";

/**
 * 基于规则的分组
 */
export function getCombinationElements(elements: Elements) {
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
        if (element0FlexDirection === flexDirection) {
          if (element0FlexDirection === element1FlexDirection) {
            calculateElements = [...element0.elements, ...(element1.elements ? element1.elements : [element1])]
          } else {
            calculateElements = [...element0.elements, element1]
          }
        } else if (element1FlexDirection === flexDirection) {
          if (element1FlexDirection === element0FlexDirection) {
            calculateElements = [...(element0.elements ? element0.elements : [element0]), ...element1.elements]
          } else {
            calculateElements = [element0, ...element1.elements]
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
        isNotAutoGroup: false
      }

      element.forEach((element) => {
        const elementStyle = element.style
        if (elementStyle.widthFull) {
          parentStyle.widthFull = 1
        }
        if (elementStyle.heightFull) {
          parentStyle.heightFull = 1
        }
        if (isNumber(elementStyle.right)) {
          parentStyle.right = 0
        }
        if (isNumber(elementStyle.bottom)) {
          parentStyle.bottom = 0
        }
      })

      if (isNumber(parentStyle.right)) {
        calculateElements.forEach((element) => {
          if (isNumber(element.style.right)) {
            element.style.right = 0 // 整体居右，所以内部居右元素可以设置为0 TODO: 在parent为非widthFull时，可以把right删除？
          }
        })
      }
      if (isNumber(parentStyle.bottom)) {
        // 居下
      }

      if (flexDirection === "column") {
        // 纵向可以把left删除，父容器设置left
        calculateElements.forEach((element) => {
          element.style.left = element.style.left - parentStyle.left
        })
      } else {
        // 横向可以把top删除，父容器设置top
        // log(2, ps(element))
      }

      // 如果是纵向合并
      // if (flexDirection === "column") {
      //   // parentStyle.right = 0
      // } else {
      //   // parentStyle.right = 0
      // }

      convertedElements.push({
        id: element0.id,
        style: parentStyle,
        elements: calculateElements
      })
    } else {
      // 直接push
      convertedElements.push(element)
    }
  })

  return convertedElements
}
