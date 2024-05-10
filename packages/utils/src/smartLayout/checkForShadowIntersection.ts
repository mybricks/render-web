import type { Element, Elements } from './'

/**
 * 右侧投影是否相交
 */
export function checkRightIntersects(elements: Elements, element: Element) {
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
export function checkBottomIntersects(elements: Elements, element: Element) {
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
export function checkTopIntersects(elements: Elements, element: Element) {
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
export function checkLeftIntersects(elements: Elements, element: Element) {
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