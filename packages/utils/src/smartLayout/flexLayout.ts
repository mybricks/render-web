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
  // 找到居中（xCenter）的元素
  const xCenterIndex = elements.findIndex((element) => element.style.xCenter);
  const { style: layoutStyle } = layoutConfig;

  // console.log({
  //   rightIndex,
  //   xCenterIndex
  // })

  if (xCenterIndex !== -1) {
    // 有居中的话，居中的权限是最高的
    // console.log("横向排列计算 有居中: ", elements)
    // 有居右元素
    // 居左的元素
    const leftElements = elements.slice(0, xCenterIndex);
    // 居右的元素
    const rightElements = elements.slice(xCenterIndex + 1);
    // 有左有右
    // 第一个元素居左距离
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
      if (elementStyle.widthFull) {
        hasLeftWidthFull = true
      }
      if (index === leftElements.length - 1) {
        leftWidth = elementStyle.left + elementStyle.width
      }
    })
    const hasLeft = !!leftElements.length;

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
      if (elementStyle.widthFull) {
        hasRightWidthFull = true
      }
      if (index === rightElements.length - 1) {
        rightWidth = elementStyle.left + elementStyle.width - rightElements[0].style.left
      }
    })

    const hasRight = !!rightElements.length;

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
      // flexWrap: "wrap",
      justifyContent: "space-between",
      // marginLeft: elementStyle.left,
      // marginRight: elementStyle.right
    }

    const xCenterElement = elements[xCenterIndex];

    // if (hasLeftWidthFull || hasRightWidthFull) {
    //   // 任意一边有宽度填充的话，需要设置横向间距
    //   // parentStyle.columnGap = rightElements[0].style.left - leftWidth
    //   parentStyle.columnGap = (xCenterElement.style.left || xCenterElement.style.right) - (leftWidth > rightWidth ? leftWidth : rightWidth)
    // }




    // 再套一层
    const flexLeftStyle = {
      flex: 1,
      display: 'flex',
    }
    const flexRightStyle = {
      flex: 1,
      display: 'flex',
      justifyContent: 'flex-end',
    }
    leftStyle.paddingLeft = elementStyle.left
    rightStyle.paddingRight = elementStyle.right

    leftWidth += (elementStyle.left || 0)
    rightWidth += (elementStyle.right || 0)

  

    // rightWidth = elementStyle.width - rightElements[0].style.left

    // console.log(elementStyle.right, 123)
    // console.log(elementStyle.left, 456)
    // console.log(rightElements[0].style.left, 'rightElements[0].style.left')

    // console.log("elementStyle: ", elementStyle)

    // console.log({
    //   leftWidth,
    //   rightWidth
    // })
    // console.log({
    //   leftStyle,
    //   rightStyle
    // })

    if (leftWidth > rightWidth) {
      // right设置paddingLeft
      rightStyle.paddingLeft = (xCenterElement.style.left || xCenterElement.style.right) - rightWidth;
    } else {
      // left设置paddingRight
      leftStyle.paddingRight = (xCenterElement.style.left || xCenterElement.style.right) - leftWidth;
    }

    // if (leftWidth > rightWidth) {
    //   // right设置paddingLeft
    //   rightStyle.paddingLeft = (xCenterElement.style.left || xCenterElement.style.right) - rightWidth - parentStyle.columnGap;
    // } else {
    //   // left设置paddingRight
    //   leftStyle.paddingRight = (xCenterElement.style.left || xCenterElement.style.right) - leftWidth - parentStyle.columnGap;
    // }
    // leftStyle.flex = 1
    // rightStyle.flex = 1
    Reflect.deleteProperty(leftStyle, "flex")
    Reflect.deleteProperty(rightStyle, "flex")

    // 如果宽度是填充，设置最小的gap

    return {
      style: parentStyle,
      elements: [
        hasLeft ? {
          id: leftElements[0].id,
          style: flexLeftStyle,
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
          ]
        } : {
          id: 'left',
          style: {
            flex: 1
          },
          elements: []
        },
        // {
        //   id: leftElements[0].id,
        //   // @ts-ignore
        //   style: leftStyle,
        //   elements: calculateLayoutRelationship(leftElements, {
        //     // @ts-ignore
        //     style: {
        //       ...elementStyle,
        //       left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
        //       right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
        //     },
        //     startOnLeft: true
        //   })
        // },
        elements[xCenterIndex],
        hasRight ? {
          id: rightElements[0].id,
          style: flexRightStyle,
          elements: [
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
        } : {
          id: 'right',
          style: {
            flex: 1
          },
          elements: []
        }


        // {
        //   id: rightElements[0].id,
        //   // @ts-ignore
        //   style: rightStyle,
        //   elements: calculateLayoutRelationship(rightElements, {
        //     // @ts-ignore
        //     style: {
        //       ...elementStyle,
        //       left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
        //       right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
        //     },
        //     startOnRight: true
        //   })
        // }
      ]
    } as any
  } else if (rightIndex !== -1) {
    // 有居右元素
    // 居左的元素
    const leftElements = elements.slice(0, rightIndex);
    // 居右的元素
    const rightElements = elements.slice(rightIndex);
    // 最后一个元素
    const layoutStyleRight = layoutStyle.width + layoutStyle.left
    if (!leftElements.length) {
      // 整行居右

      return {
        style: {
          display: 'flex',
          flexDirection: 'row',
          // flexWrap: 'wrap', // 相同方向去除换行
          justifyContent: 'flex-end',
          marginRight: elementStyle.right,
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
        if (elementStyle.widthFull) {
          hasLeftWidthFull = true
        }
        if (index === leftElements.length - 1) {
          leftWidth = elementStyle.left + elementStyle.width
        }
      })

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
        marginLeft: elementStyle.left,
        marginRight: elementStyle.right
      }

      if (hasLeftWidthFull || hasRightWidthFull) {
        // 任意一边有宽度填充的话，需要设置横向间距
        parentStyle.columnGap = rightElements[0].style.left - leftWidth
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
    return {
      style: {
        display: 'flex',
        flexDirection: 'row',
        // flexWrap: 'wrap', // 相同方向去除换行
        marginLeft: elementStyle.left
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
  console.log(bottomIndex, "bottomIndex")
  if (bottomIndex !== -1) {
    log("处理居下的情况 🔥🔥🔥🔥🔥")
  } else {
    // 没有居下，全局居上
    log("elementStyle.top: ", elementStyle.top)
    return {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'wrap',
        marginTop: elementStyle.top
      },
      elements: calculateLayoutRelationship(elements, {
        // @ts-ignore
        style: {
          ...elementStyle,
          // left: 0, // 这里默认是0，通过元素自身的magrinLeft来实现居左的间距
          // right: 0 // 这里默认是0，通过元素自身的magrinRight来实现居右的间距
          top: 0,
          bottom: 0
        },
        startOnTop: true
      })
    }
  }
}
