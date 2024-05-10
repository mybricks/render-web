import type { Elements } from "./";

/**
 * 对元素拍素，从上至下，从左至右
 */
export function sortByTopLeft(elements: Elements) {
  return elements.sort((pre, cur) => {
    const preStyle = pre.style
    const curStyle = cur.style
    if (preStyle.top === curStyle.top) {
      return preStyle.left - curStyle.left
    }
    return preStyle.top - curStyle.top
  })
}