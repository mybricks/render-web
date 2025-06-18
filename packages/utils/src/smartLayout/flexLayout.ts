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

  if (xCenterIndex !== -1) {
    // @ts-ignore
    const { parentStyle } = elementStyle;
    // 居中的权限最高，左侧居左，右侧居右
    /** 左侧元素 */
    const leftElements = elements.slice(0, xCenterIndex);
    /** 中间元素 */
    const xCenterElement = elements[xCenterIndex];
    /** 右侧元素 */
    const rightElements = elements.slice(xCenterIndex + 1);
    /** 父容器样式 */
    const parentContainerStyle: Style = {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: "space-between",
    }
    /** 左侧容器样式 */
    const leftContainerStyle: Style = {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: "wrap",

      flex: 1,
    }
    /** 左侧二层容器样式 */
    const leftSecondContainerStyle: Style = {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: "wrap",
      paddingLeft: elementStyle.left
    }
    /** 右侧容器样式 */
    const rightContainerStyle: Style = {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: "wrap",

      flex: 1,
      justifyContent: 'flex-end',
    }
    /** 左侧二层容器样式 */
    const rightSecondContainerStyle: Style = {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: "wrap",
      paddingRight: parentStyle ? parentStyle.width - elementStyle.width - elementStyle.left : elementStyle.right
    }

    /** 重新组合的elements */
    const responseElements = [];

    if (leftElements.length) {
      // 左侧有元素
      responseElements.push({
        id: leftElements[0].id,
        style: leftContainerStyle,
        elements: [{
          id: leftElements[0].id,
          style: leftSecondContainerStyle,
          elements: calculateLayoutRelationship(leftElements, {
            // @ts-ignore
            style: {
              ...elementStyle,
              left: 0,
              right: 0
            },
            startOnLeft: true
          })
        }]
      })
      // responseElements.push({
      //   id: leftElements[0].id,
      //   style: leftContainerStyle,
      //   elements: calculateLayoutRelationship(leftElements, {
      //     // @ts-ignore
      //     style: {
      //       ...elementStyle,
      //       left: 0,
      //       right: 0
      //     },
      //     startOnLeft: true
      //   })
      // })
    } else {
      responseElements.push({
        id: 'left',
        style: {
          flex: 1
        },
        elements: []
      })
    }

    responseElements.push(xCenterElement);

    if (rightElements.length) {
      // 右侧有元素
      responseElements.push({
        id: rightElements[0].id,
        style: rightContainerStyle,
        elements: [{
          id: rightElements[0].id,
          style: rightSecondContainerStyle,
          elements: calculateLayoutRelationship(rightElements, {
            // @ts-ignore
            style: {
              ...elementStyle,
              left: 0,
              right: 0
            },
            startOnRight: true
          })
        }]
      })
      // responseElements.push({
      //   id: rightElements[0].id,
      //   style: rightContainerStyle,
      //   elements: calculateLayoutRelationship(rightElements, {
      //     // @ts-ignore
      //     style: {
      //       ...elementStyle,
      //       left: 0,
      //       right: 0
      //     },
      //     startOnRight: true
      //   })
      // })
    } else {
      responseElements.push({
        id: 'right',
        style: {
          flex: 1
        },
        elements: []
      })
    }

    return {
      style: parentContainerStyle,
      elements: responseElements
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
  // 找到居中（yCenter）的元素
  const yCenterIndex = elements.findIndex((element) => element.style.yCenter);
  const { style: layoutStyle } = layoutConfig;

  if (yCenterIndex !== -1) {
    console.log("联系开发者支持y轴居中能力")
  } else if (bottomIndex !== -1) {
    // 有居下元素
    // 居上的元素
    const topElements = elements.slice(0, bottomIndex);
    // 居下的元素
    const bottomElements = elements.slice(bottomIndex);
    // 最后一个元素
    const layoutStyleBottom = layoutStyle.height + layoutStyle.top


    if (!topElements.length) {
      console.log("整体居下")
    } else if (bottomIndex !== -1) {
      // 有上有下
      // 第一个元素居上距离
      // 上侧是否有填充
      let hasTopHeightFull = false
      // 上侧高度
      let topHeight = 0
      let topStyle: Style = {
        display: 'flex',
        flexDirection: 'column',
        flexWrap: "wrap",
      }

      // 遍历计算top值
      topElements.forEach((element, index) => {
        const elementStyle = element.style
        if (elementStyle.heightFull) {
          hasTopHeightFull = true
        }
        if (index === topElements.length - 1) {
          topHeight = elementStyle.top + elementStyle.height
        }
      })

      // 下侧是否有填充
      let hasBottomHeightFull = false
      // 下侧高度
      let bottomHeight = 0
      let bottomStyle: Style = {
        display: 'flex',
        flexDirection: 'column',
        flexWrap: "wrap",
      }
      // 遍历计算bottom值
      bottomElements.forEach((element, index) => {
        const elementStyle = element.style
        if (elementStyle.heightFull) {
          hasBottomHeightFull = true
        }
        if (index === bottomElements.length - 1) {
          bottomHeight = elementStyle.top + elementStyle.height - bottomElements[0].style.top
        }
      })

      if (hasTopHeightFull && !hasBottomHeightFull) {
        /** 上填充 下不填充 */
        topStyle.flex = 1
      } else if (!hasTopHeightFull && hasBottomHeightFull) {
        /** 上不填充 下填充 */
        bottomStyle.flex = 1
      } else if (hasTopHeightFull && hasBottomHeightFull) {
        /** 两边都填充 */
        const gcd = findGCD([topHeight, bottomHeight])
        topStyle.flex = topHeight / gcd;
        bottomStyle.flex = bottomHeight / gcd;
      }

      const parentStyle: Style = {
        display: 'flex',
        flexDirection: 'column',
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: elementStyle.top,
        marginBottom: elementStyle.bottom,
        height: "100%"
      }

      if (hasTopHeightFull || hasBottomHeightFull) {
        // 任意一边有高度填充的话，需要设置纵向间距
        parentStyle.rowGap = bottomElements[0].style.left - topHeight
      }

      return {
        style: parentStyle,
        elements: [
          {
            id: topElements[0].id,
            // @ts-ignore
            style: topStyle,
            elements: calculateLayoutRelationship(topElements, {
              // @ts-ignore
              style: {
                ...elementStyle,
                top: 0, // 这里默认是0，通过元素自身的magrinTop来实现居上的间距
                bottom: 0 // 这里默认是0，通过元素自身的magrinBottom来实现下的间距
              },
              startOnTop: true
            })
          },
          {
            id: bottomElements[0].id,
            // @ts-ignore
            style: bottomStyle,
            elements: calculateLayoutRelationship(bottomElements, {
              // @ts-ignore
              style: {
                ...elementStyle,
                top: 0, // 这里默认是0，通过元素自身的magrinTop来实现居上的间距
                bottom: 0 // 这里默认是0，通过元素自身的magrinBottom来实现居下的间距
              },
              startOnBottom: true
            })
          }
        ]
      }
    }

    // 右就是下，左就是上,
    // width - height, 
    // left - top, 
    // right - bottom
  } else {
    // 没有居下，全局居上
    return {
      style: {
        display: 'flex',
        flexDirection: 'column',
        // flexWrap: 'wrap', // 相同方向去除换行
        marginTop: elementStyle.top
      },
      elements: calculateLayoutRelationship(elements, {
        // @ts-ignore
        style: {
          ...elementStyle,
          top: 0, // 这里默认是0，通过元素自身的magrinTop来实现居上的间距
          bottom: 0 // 这里默认是0，通过元素自身的magrinBottom来实现居下的间距
        },
        startOnTop: true
      })
    }
  }
}
