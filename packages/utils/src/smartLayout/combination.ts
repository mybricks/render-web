import type { Element } from './'

export default function combination(elements: Array<Element>) {
  // 先处理包含和相交的关系
  const finalElements = handleIntersectionsAndInclusions(sortByTopLeft(elements))
  const elementIdToAdjacency = getElementAdjacency(finalElements)

  return finalElements
}

/**
 * TODO:
 * 处理包含和相交关系
 */
function handleIntersectionsAndInclusions(elements: Array<Element>) {
  return elements
}

type ElementIdToAdjacency = {
  [key: string]: {
    topElements: Array<Element>
    leftElements: Array<Element>
    rightElements: Array<Element>
    bottomElements: Array<Element>
    topIntersect: boolean
    leftIntersect: boolean
    rightIntersect: boolean
    bottomIntersect: boolean
    rightElement?: Element
    rightSpace?: number
    bottomElement?: Element
    bottomSpace?: number
    topElement?: Element
    topSpace?: number
    leftElement?: Element
    leftSpace?: number
  }
}

/**
 * 获取元素相邻关系
 */
export function getElementAdjacency(elements: Array<Element>) {
  const elementIdToAdjacency: ElementIdToAdjacency = {}
  const elementIdToElementMap = {}
  elements.forEach((element => {
    elementIdToElementMap[element.id] = element
    const rightElements = []
    const bottomElements = []
    const haslog = false

    /**
     * TODO:
     * 需要优化下，现在时间复杂度较高
     */
    for (let i = 0; i < elements.length; i++) {
      /**
       * 被对比元素
       */
      const comparedElement = elements[i]
      if (!elementIdToAdjacency[comparedElement.id]) {
        elementIdToAdjacency[comparedElement.id] = {
          topElements: [],
          leftElements: [],
          rightElements: [],
          bottomElements: [],
          topIntersect: false,
          leftIntersect: false,
          rightIntersect: false,
          bottomIntersect: false
        }
      }

      if (element.id !== comparedElement.id) {
        const break1 = comparedElement.left >= element.left + element.width && comparedElement.top >= element.top + element.height
        // 被对比的在右下角就不用管了
        if (break1 || (comparedElement.left + comparedElement.width <= element.left || comparedElement.top + comparedElement.height <= element.top)) {

        } else {
          // 先看是上下还是左右
          if (comparedElement.top >= element.top + element.height) {
            bottomElements.push(comparedElement)
            elementIdToAdjacency[comparedElement.id].topElements.push(element)
          } else {
            // 左右对比
            // 找是否有相同区间的
            const sIdx = rightElements.findIndex(({top, height}) => {
              const { top: cTop, height: cHeight } = comparedElement
              if ((cTop >= top && cTop < top + height) || (cTop + cHeight <= top + height && cTop + cHeight > top)) {
                return true
              }
              return false
            })

            if (sIdx === -1) {
              // 说明没有相交的，当前右侧直接push
              rightElements.push(comparedElement)
              // 向被对比的左侧添加
              elementIdToAdjacency[comparedElement.id].leftElements.push(element)
              // TODO:看是否考虑在这里就把关系做好
            } else {
              // sIdx 说明相交了，对比left，看谁更近
              const sEle = rightElements[sIdx]
              if (comparedElement.left < sEle.left) {
                // 当前更小，替换
                rightElements.splice(sIdx, 1, comparedElement)
                // 向被对比的左侧添加
                elementIdToAdjacency[comparedElement.id].leftElements.push(element)
                // 把相同的左侧删除当前元素
                const sEleLeftEles = elementIdToAdjacency[sEle.id].leftElements
                const sEleLeftIdx = sEleLeftEles.findIndex((e) => e.id === element.id)
                if (sEleLeftIdx !== -1) {
                  sEleLeftEles.splice(sEleLeftIdx, 1)
                }
              } else {
                // 当前更大，不做处理
                haslog && console.log(9988)
              }
            }
          }
        }
      }
    }

    elementIdToAdjacency[element.id].rightElements = rightElements
    elementIdToAdjacency[element.id].bottomElements = bottomElements
  }))

  Object.entries(elementIdToAdjacency).forEach(([key, value]) => {
    const currentElement = elementIdToElementMap[key]
    value.rightIntersect = checkRightIntersects(value.rightElements, currentElement, value)
    value.bottomIntersect = checkBottomIntersects(value.bottomElements, currentElement, value)
    value.topIntersect = checkTopIntersects(value.topElements, currentElement, value)
    value.leftIntersect = checkLeftIntersects(value.leftElements, currentElement, value)
  })

  return elementIdToAdjacency
}

/**
 * 右侧是否相交
 */
function checkRightIntersects(elements: Array<Element>, element: Element, value: ElementIdToAdjacency[string]) {
  const length = elements.length

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      value.rightElement = currentElement
      value.rightSpace = currentElement.left - (element.left + element.width)
    }
    return false
  } else {
    elements.sort((pre, cur) => {
      return pre.left - cur.left
    })
    const right1Element = elements[0]
    const right2Element = elements[1]

    if (right1Element.left + right1Element.width > right2Element.left) {
      value.rightElement = right1Element
      value.rightSpace = right1Element.left - (element.left + element.width)
      return true
    }
    value.rightElement = right1Element
    value.rightSpace = right1Element.left - (element.left + element.width)
    return false
  }
}

 /**
 * 下侧是否相交
 */
function checkBottomIntersects(elements: Array<Element>, element: Element, value: ElementIdToAdjacency[string]) {
  const length = elements.length

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      value.bottomElement = currentElement
      value.bottomSpace = currentElement.top - (element.top + element.height)
    }
    return false
  } else {
    elements.sort((pre, cur) => {
      return pre.top - cur.top
    })
    const top1Element = elements[0]
    const top2Element = elements[1]

    if (top1Element.top + top1Element.height > top2Element.top) {
      value.bottomElement = top1Element
      value.bottomSpace = top1Element.top - (element.top + element.height)
      return true
    } 
    value.bottomElement = top1Element
    value.bottomSpace = top1Element.top - (element.top + element.height)
    return false
  }
}

/**
 * 上侧是否相交
 */
function checkTopIntersects(elements: Array<Element>, element: Element, value: ElementIdToAdjacency[string]) {
  const length = elements.length

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      value.topElement = currentElement
      value.topSpace = element.top - (currentElement.top + currentElement.height)
    }
    return false
  } else {
    elements.sort((pre, cur) => {
      return  (cur.top + cur.height) - (pre.top + pre.height)
    })
    const top1Element = elements[0]
    const top2Element = elements[1]

    if (top2Element.top + top2Element.height > top1Element.top) {
      value.topElement = top1Element
      value.topSpace = element.top - (top1Element.top + top1Element.height)
      return true
    }
    value.topElement = top1Element
    value.topSpace = element.top - (top1Element.top + top1Element.height)
    return false
  }
}

/**
 * 左侧是否相交
 */
function checkLeftIntersects(elements: Array<Element>, element: Element, value: ElementIdToAdjacency[string]) {
  const length = elements.length

  if (!length || length === 1) {
    const currentElement = elements[0]
    if (currentElement) {
      value.leftElement = currentElement
      value.leftSpace = element.left - (currentElement.left + currentElement.width)
    }
    return false
  } else {
    elements.sort((pre, cur) => {
      return (cur.left + cur.width) - (pre.left + pre.width)
    })
    const top1Element = elements[0]
    const top2Element = elements[1]

    if (top2Element.left + top2Element.width > top1Element.left) {
      value.leftElement = top1Element
      value.leftSpace = element.left - (top1Element.left + top1Element.width)
      return true
    }
    value.leftElement = top1Element
    value.leftSpace = element.left - (top1Element.left + top1Element.width)
    return false
  }
}

/**
 * 从上至下，从左至右排序
 */
function sortByTopLeft(elements: Array<Element>) {
  return elements.sort((pre, cur) => {
    if (pre.top === cur.top) {
      return pre.left - cur.left
    }
    return pre.top - cur.top
  })
}