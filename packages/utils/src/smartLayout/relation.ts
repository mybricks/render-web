import { isNumber } from "../type";
import combination from './combination';
import { checkTopIntersects, checkRightIntersects, checkBottomIntersects, checkLeftIntersects } from "./checkForShadowIntersection";

import type { Elements } from ".";

/**
 * 处理相交关系
 * TODO:
 * 实现较临时，改天重构下
 *  - 只有相交
 */
export function handleIntersectionsAndInclusions(elements: Elements) {
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
          /** 这里决定定位也不合理，可能只是marginTop向上移动 */
          // brotherToIdMap[nextElement.id] = element.id;
          // idToElementMap[element.id].brother.push(idToElementMap[nextElement.id])
          // isBrotherIdsMap[nextElement.id] = {
          //   index: j
          // };
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
              right: isNumber(child.style.right) ? (style.left + style.width) - (child.style.left + child.style.width) : null,
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
            right: 0,
            bottom: 0,
            flexDirection: "column"
          },
          // root: true
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

export function getElementRelation({width: widthA, height: heightA, top: topA, left: leftA}, {width: widthB, height: heightB, top: topB, left: leftB}) {
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

/** 元素信息 */
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
      // single: !left && !right && !bottom && !top,// 上下左右都没有，才算单个组件
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
