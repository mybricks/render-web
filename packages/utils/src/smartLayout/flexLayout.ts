import { Style } from "@mybricks/render-types";
import { isNumber } from "../type";
import { findGCD } from "../normal";
import { calculateLayoutRelationship, log, ps } from "./combination";
import type { Element, Elements, DefaultLayoutConfig as LayoutConfig } from './'

export function rowFlexLayout(element: Element, layoutConfig: LayoutConfig): {
  style: Style,
  elements: Elements
} {
  const { elements, style: elementStyle } = element;
  // 找到第一个右对齐元素
  const rightIndex = elements.sort((p, c) => p.style.left - c.style.left).findIndex((element) => isNumber(element.style.right));
  const { style: layoutStyle } = layoutConfig;
  const { isNotAutoGroup } = layoutStyle

  if (rightIndex !== -1) {
    // 有居右元素
    // 居左的元素
    const leftElements = elements.slice(0, rightIndex);
    // 居右的元素
    const rightElements = elements.slice(rightIndex);
    // 最后一个元素
    const layoutStyleRight = layoutStyle.width + layoutStyle.left
    if (!leftElements.length) {
      // 整行居右
      // 最后一个元素的居右距离
      const lastRight = layoutStyleRight - elementStyle.left - elementStyle.width

      // 遍历计算right值
      rightElements.forEach((element) => {
        const elementStyle = element.style
        elementStyle.right = layoutStyleRight - elementStyle.left - elementStyle.width - lastRight
        // TOD
        // if (element.elements) {
        //   element.elements.forEach((element) => {
        //     element.style.right = element.style.right - lastRight
        //   })
        // }
      })

      return {
        style: {
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          marginRight: lastRight,
        },
        elements: calculateLayoutRelationship(rightElements, {
          // @ts-ignore
          style: {
            ...elementStyle,
            left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
            right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
          },
          startOnRight: true
        })
      }
    } else {
      // 有左有右
      // 第一个元素居左距离
      const firstLeft = leftElements[0].style.left
      // 左侧是否有填充
      let hasLeftWidthFull = false
      // 左侧宽度
      let leftWidth = 0
      let leftStyle: Style = {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: "wrap",
      }
      // 遍历计算left值
      leftElements.forEach((element, index) => {
        const elementStyle = element.style
        elementStyle.left = elementStyle.left - firstLeft
        if (elementStyle.widthFull) {
          hasLeftWidthFull = true
        }
        if (index === leftElements.length - 1) {
          leftWidth = elementStyle.left + elementStyle.width
        }
      })


      // 最后一个元素的居右距离
      // const lastRight = layoutStyleRight - elementStyle.left - elementStyle.width
      const lastRight = isNotAutoGroup ? layoutStyle.width - elementStyle.left - elementStyle.width : rightElements[rightElements.length - 1].style.right
      // 右侧是否有填充
      let hasRightWidthFull = false
      // 右侧宽度
      let rightWidth = 0
      let rightStyle: Style = {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: "wrap",
      }
      // 遍历计算right值
      rightElements.forEach((element, index) => {
        const elementStyle = element.style
        elementStyle.right = layoutStyleRight - elementStyle.left - elementStyle.width - lastRight
        if (element.elements) {
          element.elements.forEach((element) => {
            element.style.right = element.style.right - lastRight
          })
        }
        if (elementStyle.widthFull) {
          hasRightWidthFull = true
        }
        if (index === rightElements.length - 1) {
          rightWidth = elementStyle.left + elementStyle.width - rightElements[0].style.left
        }
      })

      if (hasLeftWidthFull && !hasRightWidthFull) {
        /** 左填充 右不填充 */
        leftStyle.flex = 1
      } else if (!hasLeftWidthFull && hasRightWidthFull) {
        /** 左不填充 右填充 */
        rightStyle.flex = 1
      } else if (hasLeftWidthFull && hasRightWidthFull) {
        /** 两边都填充 */
        const gcd = findGCD([leftWidth, rightWidth])
        leftStyle.flex = leftWidth / gcd;
        rightStyle.flex = rightWidth / gcd;
      }

      const parentStyle: Style = {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginLeft: isNotAutoGroup ? firstLeft : 0,
        marginRight: isNotAutoGroup ? lastRight : 0
      }

      if (hasLeftWidthFull || hasRightWidthFull) {
        // 任意一边有宽度填充的话，需要设置横向间距
        parentStyle.columnGap = rightElements[0].style.left - leftWidth - firstLeft
      }

      return {
        style: parentStyle,
        elements: [
          {
            id: leftElements[0].id,
            // @ts-ignore
            style: leftStyle,
            elements: calculateLayoutRelationship(leftElements, {
              // @ts-ignore
              style: {
                ...elementStyle,
                left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
                right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
              },
              startOnLeft: true
            })
          },
          {
            id: rightElements[0].id,
            // @ts-ignore
            style: rightStyle,
            elements: calculateLayoutRelationship(rightElements, {
              // @ts-ignore
              style: {
                ...elementStyle,
                left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
                right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
              },
              startOnRight: true
            })
          }
        ]
      }
    }
  } else {
    // 没有居右，全局居左
    // 第一个元素居左距离
    const firstLeft = elements[0].style.left
    // 遍历计算left值
    elements.forEach((element) => {
      const elementStyle = element.style
      elementStyle.left = elementStyle.left - firstLeft
    })
    return {
      style: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginLeft: firstLeft
      },
      elements: calculateLayoutRelationship(elements, {
        // @ts-ignore
        style: {
          ...elementStyle,
          left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
          right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
        },
        startOnLeft: true
      })
    }
  }
}

// right -> bottom
// left -> top

export function columnFlexLayout(element: Element, layoutConfig: LayoutConfig) {
  const { elements, style: elementStyle } = element;
  // 找到第一个下对齐元素
  const bottomIndex = elements.sort((p, c) => p.style.top - c.style.top).findIndex((element) => isNumber(element.style.bottom));
  const { style: layoutStyle } = layoutConfig;

  log("bottomIndex: ", bottomIndex)
  if (bottomIndex !== -1) {

  } else {
    // 没有居下，全局居上
    // 第一个元素居上距离
    const firstTop = elements[0].style.top
    // 遍历计算left值
    elements.forEach((element) => {
      const elementStyle = element.style
      elementStyle.top = elementStyle.top - firstTop
    })

    log(111, ps(elements), ps({
      // @ts-ignore
      style: {
        ...elementStyle,
        top: 0,
        bottom: 0,
        left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
        right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
      },
      startOnLeft: true
    }))
    
    return {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'wrap',
        marginTop: firstTop
      },
      elements: calculateLayoutRelationship(elements, {
        // @ts-ignore
        style: {
          ...elementStyle,
          top: 0,
          bottom: 0,
          left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
          right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
        },
        // startOnLeft: true
      })
    }
  }

}
