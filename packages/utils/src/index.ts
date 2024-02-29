import smartLayout from "./smartLayout";

interface ToJSON {
  [key: string]: any
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


export function transformToJSON(toJSON: ToJSON) {
  const { global, modules, scenes } = toJSON
  if (!scenes) {
    return toJSON
  }
  if (global) {
    const { comsReg, consReg, pinRels, fxFrames, pinProxies } = global
    if (comsReg) {
      Object.keys(comsReg).forEach((key) => {
        comsReg[key].global = true
      })
    }
    if (Array.isArray(fxFrames)) {
      fxFrames.forEach((fxFrame) => {
        if (comsReg) {
          Object.assign(fxFrame.coms, comsReg)
        }
        if (consReg) {
          Object.assign(fxFrame.cons, consReg)
        }
        if (pinRels) {
          Object.assign(fxFrame.pinRels, pinRels)
        }
        if (pinProxies) {
          Object.assign(fxFrame.pinProxies, pinProxies)
        }
      })
    }
    
    // TODO: 临时写死的，等引擎提供数据
    const transform = new Transform()

    if (modules) {
      Object.entries(modules).forEach(([key, module]: any) => {
        const { json } = module
        transform.transformSlotComAry(json.slot, json.coms)

        if (comsReg) {
          Object.assign(json.coms, comsReg)
        }
        if (consReg) {
          Object.assign(json.cons, consReg)
        }
        if (pinRels) {
          Object.assign(json.pinRels, pinRels)
        }
        if (pinProxies) {
          Object.assign(json.pinProxies, pinProxies)
        }
      })
    }

    scenes.forEach((scene: any) => {
      transform.transformSlotComAry(scene.slot, scene.coms)

      if (comsReg) {
        Object.assign(scene.coms, comsReg)
      }
      if (consReg) {
        Object.assign(scene.cons, consReg)
      }
      if (pinRels) {
        Object.assign(scene.pinRels, pinRels)
      }
      if (pinProxies) {
        Object.assign(scene.pinProxies, pinProxies)
      }
    })
  }

  return toJSON
}

export function transformSingleToJSON(toJSON: any) {
  const transform = new Transform()
  transform.transformSlotComAry(toJSON.slot, toJSON.coms)
}

class Transform {

  comIdToSlotComMap = {}

  constructor() {
    // console.log("toJSON相关计算")
  }

  transformSlotComAry(slot, coms) {
    const { comIdToSlotComMap } = this
    const { comAry } = slot
  
    // TODO: 目前引擎可以通过这个字段来判断是否智能布局
    if (slot.style.layout === "smart") {
      const resultComAry = comAry.sort((preCom, curCom) => {
        const { id: preId } = preCom
        const { id: curId } = curCom
  
        const preStyle = coms[preId].model.style
        const preTop = preStyle.top
        const preLeft = preStyle.left
        const curStyle = coms[curId].model.style
        const curTop = curStyle.top
        const curLeft = curStyle.left
    
        if (preTop === curTop) {
          return preLeft - curLeft
        }
    
        return preTop - curTop
      })

      comAry.forEach(({slots}) => {
        if (slots) {
          Object.entries(slots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
      })

      // console.log("计算数组初始化 resultComAry: ", resultComAry.map((com) => {
      //   const id = com.id
      //   const comInfo = coms[id]
      //   const style = comInfo.model.style
      //   const calculateStyle = comInfo.style

      //   comIdToSlotComMap[id] = com
  
      //   return {
      //     id,
      //     style: {
      //       width: calculateStyle.width || 0,
      //       height: calculateStyle.height || 0,
      //       top: style.top || 0,
      //       left: style.left || 0,
      //       flexX: style.flexX
      //     }
      //   }
      // }))


      const comAry2 = smartLayout(resultComAry.map((com) => {
        const id = com.id
        const comInfo = coms[id]
        const style = comInfo.model.style
        const calculateStyle = comInfo.style

        comIdToSlotComMap[id] = com

        return {
          id,
          style: {
            width: calculateStyle.width,
            height: calculateStyle.height,
            top: typeof style.bottom === 'number' ? slot.style.height - calculateStyle.height - style.bottom : (style.top || 0),
            left: typeof style.right === 'number' ? slot.style.width - calculateStyle.width - style.right : (style.left || 0),
            flexX: style.flexX
          },
          // constraints: comInfo.constraints
        }

      }), { style: { width: slot.style.width }})



      const traverseElementsToSlotComAry3 = (comAry) => {
        const result = []
        comAry.forEach((com) => {
          const { id, style, elements } = com

          if (Array.isArray(elements)) {
            Reflect.deleteProperty(style, 'height')
            result.push({
              ...com,
              elements: traverseElementsToSlotComAry3(elements)
            })
          } else {
            const modelStyle = coms[id].model.style
            modelStyle.position = 'relative'
            // modelStyle.marginTop = style.marginTop
            // modelStyle.marginLeft = style.marginLeft

            // console.log(com, 'com', coms[id])
            // console.log(style, 'style')
            // console.log("modelStyle: ", JSON.parse(JSON.stringify(modelStyle)))
            if (modelStyle.height === 'auto') {
              modelStyle.height = 'fit-content'
            }
            if (modelStyle.flexY === 1) {
              Reflect.deleteProperty(modelStyle, "height")
            }

            if (style.flex) {
              modelStyle.flex = style.flex
              modelStyle.margin = style.margin
              Reflect.deleteProperty(modelStyle, "width")
              Reflect.deleteProperty(modelStyle, "maxWidth")
            } else if (style.width === 'auto') {
              modelStyle.margin = style.margin
              modelStyle.width = 'auto'
              Reflect.deleteProperty(modelStyle, "maxWidth")
            } else {
              modelStyle.marginTop = style.marginTop
              modelStyle.marginLeft = style.marginLeft
            }
            result.push(comIdToSlotComMap[id])
          }
        })
    
        return result
      }

      // console.log(" 🚀 最终结果前 comAry2: ", comAry2)

      slot.comAry2 = traverseElementsToSlotComAry3(comAry2)

      // console.log(" 🏆 最终 comAry2 结果: ", slot.comAry2)

      
    

      // const comAry2 = this.traverseElementsToSlotComAry2(traverseElements2(resultComAry.map((com) => {
      //   const id = com.id
      //   const comInfo = coms[id]
      //   const style = comInfo.model.style
      //   const calculateStyle = comInfo.style

      //   comIdToSlotComMap[id] = com
  
      //   return {
      //     id,
      //     width: calculateStyle.width || 0,
      //     height: calculateStyle.height || 0,
      //     top: style.top || 0,
      //     left: style.left || 0,
      //     children: [],
      //     brother: []
      //   }
      // }), { width: slot.style.width }), coms)
      // // console.log("🛹 开始处理comAry2: ", JSON.parse(JSON.stringify(comAry2)))
      // slot.comAry2 = this.transformComAry2(comAry2, coms, {
      //   com: { width: slot.style.width, marginLeft: 0, marginTop: 0, flexDirection: 'row' },
      //   parentCom: { width: slot.style.width, marginLeft: 0, marginTop: 0, flexDirection: 'row' },
      // })

      // const comAry3 = this.traverseElementsToSlotComAry2(traverseElements2(resultComAry.map((com) => {
      //   const id = com.id
      //   const comInfo = coms[id]
      //   const style = comInfo.model.style
      //   const calculateStyle = comInfo.style

      //   comIdToSlotComMap[id] = com
  
      //   return {
      //     id,
      //     width: calculateStyle.width || 0,
      //     height: calculateStyle.height || 0,
      //     top: style.top || 0,
      //     left: style.left || 0,
      //     children: [],
      //     brother: []
      //   }
      // }), { width: slot.style.width }), coms)
      // // console.log("🛹 开始处理comAry2: ", JSON.parse(JSON.stringify(comAry2)))
      // slot.comAry3 = this.transformComAry2(comAry3, coms, {
      //   com: { width: slot.style.width, marginLeft: 0, marginTop: 0, flexDirection: 'row' },
      //   parentCom: { width: slot.style.width, marginLeft: 0, marginTop: 0, flexDirection: 'row' },
      // })

      // console.log("之前的结果是: ", comAry3)


      
      // console.log("最终结果: ", slot.comAry2)
    } else {
      comAry.forEach((com) => {
        const { slots } = com
        if (slots) {
          Object.entries(slots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
      })
    }
  }

  isSameGroup(elements) {
    if (elements.length < 2) {
      return true
    }

    let hasTempElements = false
    let noTempElements = false

    for (let i = 0; i < elements.length; i++) {
      const ele = elements[i]
      if (ele.tempElements) {
        hasTempElements = true
      } else {
        noTempElements = true
      }

      if (hasTempElements && noTempElements) {
        break
      }
    }

    return hasTempElements !== noTempElements
  }

  transformComAry2(comAry: any, coms: any, { com: propsCom, parentCom: propsParentCom, isSameGroup = false }) {
    const haslog = false
    const res = []
    // 设置了宽度百分百的宽度数组
    const widthAry = []
    // 上述数组的index对应com的style
    const flexMap = {}
    // 设置宽度百分百的com的总宽度
    let sumWidth = 0

    haslog && console.log("处理的comAry: ", comAry)

    comAry.forEach((com) => {
      if (com.def) {
        res.push(com)
      } else {
        if (!com.flexDirection) {
          haslog && console.log(1, "🚗 单组件")
          const style: any = {
            display: 'flex',
            flexDirection: com.flexDirection,
            marginTop: com.marginTop,
            height: 'fit-content'
          }
          const ele = com.elements[0]
          const comInfo = coms[ele.id]
          const comStyle = comInfo.model.style

          if (comStyle.flexX) {
            haslog && console.log(5, "🍎 单组件宽度100%")
            comStyle.width = '100%'
            Reflect.deleteProperty(comStyle, 'maxWidth')
            const styleWidth = comInfo.style.width
            widthAry.push(styleWidth)
            sumWidth = sumWidth + styleWidth
            flexMap[widthAry.length - 1] = style


            let marginRight

            if (isSameGroup) {
              haslog && console.log(11, "🍎 单组件同时处理，右边距一定是0 - 观察")
              if (propsCom.flexDirection === 'row') {
                haslog && console.log(18, "🍎 单组件横向，右边距一定是0")
                marginRight = 0
              } else {
                haslog && console.log(19, "🍎 单组件纵向，计算右边距")
                marginRight = propsCom.width - com.marginLeft - com.width
              }
            } else {
              // propsCom.flexDirection === 'row' // 观察
              if (propsCom.flexDirection === 'row' && propsParentCom.flexDirection === 'row' && com.parentFlexDirection === 'row') {
                haslog && console.log(37, "🍎 单组件非同时处理，横向，右边距一定是0 - 这里计算观察下可能有问题")
                marginRight = 0
                // marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
              } else {
                haslog && console.log(12, "🍎 单组件非同时处理，正常计算右边距")
                marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
              }
              
            }
           
            style.margin = `${com.marginTop}px ${marginRight}px 0px ${com.marginLeft}px`
            haslog && console.log(1, "style.margin: ", style.margin)
          } else {
            haslog && console.log(6, "🍎 单组件宽度不需要处理")
            let marginRight

            if (isSameGroup) {
              if (propsCom.flexDirection === 'row') {
                haslog && console.log(15, "🍎 单组件横向，右边距一定是0")
                marginRight = 0
              } else {
                haslog && console.log(16, "🍎 单组件纵向，计算右边距")
                marginRight = propsCom.width - com.marginLeft - com.width
              }
            } else {
              haslog && console.log(17, "🍎 单组件非同时处理，正常计算右边距 - 这里计算观察下可能有问题")
              // marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
              marginRight = propsCom.width - com.width - com.marginLeft
            }
            if (marginRight === com.marginLeft) {
              haslog && console.log(7, "🍎 单组件居中")
              style.justifyContent = 'center'
            } else {
              haslog && console.log(8, "🍎 单组件不居中", com.marginLeft)
              style.marginLeft = com.marginLeft
            }
          }
          res.push({
            id: com.id,
            style,
            elements: com.elements
          })
        } else {
          haslog && console.log(2, "🚗🚗 多组件")
          const elements = com.elements
          if (elements.length !== 1 && this.isSameGroup(elements)) {
            haslog && console.log(3, "🐶 同时处理 => ", elements)
            const style: any = {
              display: 'flex',
              flexDirection: com.flexDirection,
              marginTop: com.marginTop,
              height: 'fit-content'
            }
            const relEles = this.transformComAry2(elements, coms, {
              com,
              parentCom: propsCom,
              isSameGroup: true
            })

            if (relEles.some((ele) => ele.style.flex)) {
              haslog && console.log(13, "🍌 多组件里有宽度100%的组件，这里区分下横着和竖着？")

              if (com.flexDirection === 'column') {
                haslog && console.log(40, "🍌 多组件 - 容器是纵向的，把flex数据干掉 => ")
                relEles.forEach(ele => {
                  Reflect.deleteProperty(ele.style, 'flex')
                })
              }

              const styleWidth = com.width
              widthAry.push(styleWidth)
              sumWidth = sumWidth + styleWidth
              flexMap[widthAry.length - 1] = style

              let marginRight

              if (isSameGroup) {
                if (propsCom.flexDirection === 'row') {
                  haslog && console.log(20, "🍌 多组件横向，右边距一定是0 -- 这里在观察下，应该是有问题，有100%组件了，一定是flex:xx")
                  marginRight = 0
                } else {
                  haslog && console.log(21, "🍌 多组件纵向，计算右边距")
                  marginRight = propsCom.width - com.marginLeft - com.width
                }
              } else {
                // if (propsCom.flexDirection === 'row') { 观察

                // com.flexDirection === 'column' && com.parentFlexDirection === 'column'
                // com.flexDirection === 'row' && com.parentFlexDirection === 'row'

                // console.log("com: ", com)
                //   console.log("propsCom: ", propsCom)
                //   console.log("propsParentCom: ", propsParentCom)

                  // && (JSON.stringify(propsCom) !== JSON.stringify(propsParentCom))
                // TODO:外层特殊处理
                if (((com.flexDirection === com.parentFlexDirection) || com.parentFlexDirection === 'row') && com.flexDirection === 'row') {
                  haslog && console.log(36, "🍌 多组件非同时处理，横向，右边距一定是0 - 这里计算观察下可能有问题")
                  marginRight = 0 // 智能布局，这里有大问题.json 需要设置为0
                  // marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                 
                } else {
                  haslog && console.log(22, "🍌 多组件非同时处理，正常计算右边距", propsCom.flexDirection)
                  marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                }
              }
            
              style.margin = `${com.marginTop}px ${marginRight}px 0px ${com.marginLeft}px`
              haslog && console.log(2, "style.margin: ", style.margin)
            } else {
              haslog && console.log(14, "🍌 多组件里没有宽度100%的组件")

              let marginRight

              if (isSameGroup) {
                if (propsCom.flexDirection === 'row') {
                  marginRight = 0
                } else {
                  haslog && console.log(24, "🍌 多组件纵向，计算右边距")
                  marginRight = propsCom.width - com.marginLeft - com.width
                }
              } else {
                haslog && console.log(25, "🍌 多组件非同时处理，正常计算右边距")
                marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
              }
  
              if (marginRight === com.marginLeft) {
                haslog && console.log(9, "🍌 多组件居中")
                style.justifyContent = 'center'
                // relEles = [
                //   {
                //     id: com.id,
                //     style,
                //     elements: relEles
                //   }
                // ]

              } else {
                haslog && console.log(10, "🍌 多组件不居中，设置width fit-content和marginLeft")
                haslog && console.log("这里设定marginLeft: ", com.marginLeft)
                style.marginLeft = com.marginLeft
                style.width = 'fit-content'
              }
            }

            if (com.flexDirection === 'column' && style.justifyContent === 'center') {
              haslog && console.log(42, "🍌 临时测试需要观察，如果多组件纵向并且居中了，那么需要多嵌套一层")
              res.push({
                id: com.id,
                style: {
                  display: 'flex',
                  justifyContent: 'center',
                },
                // style,
                elements: [
                  {
                    id: com.id,
                    style,
                    elements: relEles
                  }
                ]
              })
            } else {
              res.push({
                id: com.id,
                style,
                elements: relEles
              })
            }
            
            // res.push({
            //   id: com.id,
            //   style,
            //   elements: relEles
            // })
          } else {
            haslog && console.log(4, "🐱 分开处理 => ", elements)

            if (com.flexDirection === 'row') {
              haslog && console.log("🐦 当前信息 com: ", com)
              haslog && console.log(23, "🐱 分开处理 - 横向 => ", elements)
              const style: any = {
                display: 'flex',
                flexDirection: com.flexDirection,
                marginTop: com.marginTop,
                height: 'fit-content'
              }
              const relEles = this.transformComAry2(elements, coms, {
                com: propsCom,
                parentCom: propsParentCom
              })

              haslog && console.log("结果 relEles: ", relEles)

              if (relEles.some((ele) => ele.style.flex)) {
                haslog && console.log(27, "🐱 分开处理 - 里面有宽度100%的组件 => ")

                if (com.flexDirection === 'column') {
                  console.log(41, "🐱 分开处理 - 容器是纵向的，把flex数据干掉 => ")
                  relEles.forEach(ele => {
                    Reflect.deleteProperty(ele.style, 'flex')
                  })
                }

                const styleWidth = com.width
                widthAry.push(styleWidth)
                sumWidth = sumWidth + styleWidth
                flexMap[widthAry.length - 1] = style
                
                let marginRight

                if (isSameGroup) {
                  if (propsCom.flexDirection === 'row') {
                    haslog && console.log(28, "🐱 分开处理 - 右边距一定是0")
                    marginRight = 0
                    // const styleWidth = com.width
                    // widthAry.push(styleWidth)
                    // sumWidth = sumWidth + styleWidth
                    // flexMap[widthAry.length - 1] = style
                  } else {
                    haslog && console.log(29, "🐱 分开处理 - 纵向，计算右边距")
                    marginRight = propsCom.width - com.marginLeft - com.width
                  }
                } else {
                  haslog && console.log(30, "🐱 分开处理 - 同时处理，正常计算右边距")
                  marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                }

                style.margin = `${com.marginTop}px ${marginRight}px 0px ${com.marginLeft}px`
                haslog && console.log(3, "style.margin: ", style.margin)
              } else {
                haslog && console.log(31, "🐱 分开处理 - 没有宽度100%的组件")

                let marginRight

                if (isSameGroup) {
                  if (propsCom.flexDirection === 'row') {
                    marginRight = 0
                  } else {
                    marginRight = propsCom.width - com.marginLeft - com.width
                  }
                } else {
                  marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                }
    
                if (marginRight === com.marginLeft) {
                  style.justifyContent = 'center'
                } else {
                  style.marginLeft = com.marginLeft
                  style.width = 'fit-content'
                  console.log("观察这里，可能出现的问题: ", marginRight)
                  style.marginRight = marginRight
                }
              }

              res.push({
                id: com.id,
                style,
                elements: relEles
              })
            } else {
              haslog && console.log(26, "🐱 分开处理 - 纵向 => ", elements)

              if (com.parentFlexDirection === 'column' || !com.parentFlexDirection) {
                haslog && console.log(38, "🐱 分开处理 - 纵向 - 父节点是纵向（可以直接push） => ", elements)
                const relEles = this.transformComAry2(elements.map((ele, index) => {
                  return {
                    ...ele,
                    marginTop: !index ? ele.marginTop + com.marginTop : ele.marginTop, // 第一条需要处理高度问题
                    marginLeft: ele.marginLeft + com.marginLeft
                  }
                }), coms, {
                  com: propsCom,
                  parentCom: propsParentCom
                })
                res.push(...relEles)
              } else {
                haslog && console.log(39, "🐱 分开处理 - 横向 - 父节点是横向（这里要自成一组） => ", elements)
                const style: any = {
                  display: 'flex',
                  flexDirection: com.flexDirection,
                  marginTop: com.marginTop,
                  height: 'fit-content'
                }
                const relEles = this.transformComAry2(elements, coms, {
                  com: propsCom,
                  parentCom: propsParentCom
                })

                if (relEles.some((ele) => ele.style.flex)) {
                  if (com.flexDirection === 'column') {
                    relEles.forEach(ele => {
                      Reflect.deleteProperty(ele.style, 'flex')
                    })
                  }

                  const styleWidth = com.width
                  widthAry.push(styleWidth)
                  sumWidth = sumWidth + styleWidth
                  flexMap[widthAry.length - 1] = style

                  let marginRight

                  if (isSameGroup) {
                    if (propsCom.flexDirection === 'row') {
                      marginRight = 0
                      // const styleWidth = com.width
                      // widthAry.push(styleWidth)
                      // sumWidth = sumWidth + styleWidth
                      // flexMap[widthAry.length - 1] = style
                    } else {
                      marginRight = propsCom.width - com.marginLeft - com.width
                    }
                  } else {
                    // propsCom.flexDirection === 'row' 观察
                    if (com.parentFlexDirection !== com.flexDirection) {
                      marginRight = 0 // 智能布局，这里有大问题.json 需要设置为0
                      // marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                   
                    } else {
                      debugger
                      marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                    }
                  }
                
                  style.margin = `${com.marginTop}px ${marginRight}px 0px ${com.marginLeft}px`
                  haslog && console.log(4, "style.margin: ", style.margin)
                } else {

                  // let marginRight

                  // if (isSameGroup) {
                  //   if (propsCom.flexDirection === 'row') {
                  //     marginRight = 0
                  //   } else {
                  //     console.log(24, "🍌 多组件纵向，计算右边距")
                  //     marginRight = propsCom.width - com.marginLeft - com.width
                  //   }
                  // } else {
                  //   console.log(25, "🍌 多组件非同时处理，正常计算右边距")
                  //   marginRight = propsCom.width - propsCom.marginLeft - com.width - com.marginLeft
                  // }
      
                  // if (marginRight === com.marginLeft) {
                  //   console.log(9, "🍌 多组件居中")
                  //   style.justifyContent = 'center'
                  // } else {
                  //   console.log(10, "🍌 多组件不居中，设置width fit-content和marginLeft")
                  //   console.log("这里设定marginLeft: ", com.marginLeft)
                  //   style.marginLeft = com.marginLeft
                  //   style.width = 'fit-content'
                  // }
                }

                style.marginLeft = com.marginLeft

                res.push({
                  id: com.id,
                  style,
                  elements: relEles
                })
              }
            }
          }
        }
      }
    })

    if (widthAry.length) {
      const gcd = findGCD(widthAry)
      // console.log("gcd: ", gcd)
      widthAry.forEach((width, index) => {
        const style = flexMap[index]
        style.flex = width / gcd
      })
    }

    return res
  }

  traverseElementsToSlotComAry2(comAry: any, coms: any) {
    const { comIdToSlotComMap } = this
    const result = []
    comAry.forEach((com) => {
      const { id, elements, tempElements, marginLeft, marginTop, flexDirection, height, width } = com
      if (Array.isArray(elements)) {
        result.push({
          ...com,
          elements: this.traverseElementsToSlotComAry2(elements, coms)
        })
      } else if (Array.isArray(tempElements)) {
        result.push({
          ...com,
          elements: this.traverseElementsToSlotComAry2(tempElements, coms)
        })
      } else {
        const modelStyle = coms[id].model.style
        modelStyle.position = 'relative'
        modelStyle.marginTop = marginTop
        modelStyle.marginLeft = marginLeft
        result.push(comIdToSlotComMap[id])
      }
    })

    return result
  }
}

export function traverseElements2(elements, config) {
  // console.log("🚄 初始化 elements: ", elements)
  const traverseElements = new TraverseElements(elements, config)
  const res = traverseElements.getElements()
  return res
}

class TraverseElements {
  constructor(private elements, private config) {
    // console.log("通用元素计算")
  }

  getElements() {
    const { elements } = this
    const eleGroup = this.splitElements2(this.handleIntersectionsAndInclusions(elements))
    return this.handleEleGroup(eleGroup, { top: 0, left: 0 })
  }

  handleEleGroup(elements, { top: pTop, left: pLeft }) {
    const resEles: any = []
    let curTop = pTop
    let curLeft = pLeft

    if (elements.length === 1) {
      const ele = elements[0]
      const resEle: any = {
        ...ele,
        marginTop: ele.top - curTop,
        marginLeft: ele.left - curLeft
      }
      if (Array.isArray(ele.elements)) {
        resEle.elements = this.handleEleGroup(ele.elements, {
          top: resEle.marginTop,
          left: resEle.marginLeft
        })
      }
      resEles.push(resEle)
    } else {
      let curTop = pTop
      let curLeft = pLeft
      elements.forEach((ele) => {
        const resEle: any = {...ele}
        const parentFlexDirection = ele.parentFlexDirection
        resEle.marginLeft = ele.left - curLeft
        resEle.marginTop = ele.top - curTop

        if (Array.isArray(ele.elements)) {
          resEle.elements = this.handleEleGroup(ele.elements, {
            top: curTop + resEle.marginTop,
            left: curLeft + resEle.marginLeft
          })
        }

        if (parentFlexDirection === 'row') {
          curLeft = ele.left + ele.width
        } else if (parentFlexDirection === 'column') {
          curTop = ele.top + ele.height
        }

        resEles.push(resEle)
      })
    }

    return resEles
  }

  handleIntersectionsAndInclusions(elements: any) {
    // 处理包含和相交关系
    return elements
  }

  /**
   * 是否相交
   * - 是 true
   * - 否 false
   */
  checkRightIntersects(elements, ele, value) {
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.rightEle = cEle
        value.rightSpace = cEle.left - (ele.left + ele.width)
      }
      
      return false
    } else {
      elements.sort((pre, cur) => {
        return pre.left - cur.left
      })
      const right1Ele = elements[0]
      const right2Ele = elements[1]

      if (right1Ele.left + right1Ele.width > right2Ele.left) {
        value.rightEle = right1Ele
        value.rightSpace = right1Ele.left - (ele.left + ele.width)
        return true
      }
      value.rightEle = right1Ele
      value.rightSpace = right1Ele.left - (ele.left + ele.width)
      return false
    }
  }

   /**
   * 是否相交
   * - 是 true
   * - 否 false
   */
  checkBottomIntersects(elements, ele, value) {
    // 全量对比版本
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.bottomEle = cEle
        value.bottomSpace = cEle.top - (ele.top + ele.height)
      }
      return false
    } else {
      elements.sort((pre, cur) => {
        return pre.top - cur.top
      })
      const top1Ele = elements[0]
      const top2Ele = elements[1]

      if (top1Ele.top + top1Ele.height > top2Ele.top) {
        value.bottomEle = top1Ele
        value.bottomSpace = top1Ele.top - (ele.top + ele.height)
        return true
      } 
      value.bottomEle = top1Ele
      value.bottomSpace = top1Ele.top - (ele.top + ele.height)
      return false
    }
  }

  checkTopIntersects(elements, ele, value) {
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.topEle = cEle
        value.topSpace = ele.top - (cEle.top + cEle.height)
      }
      return false
    } else {
      elements.sort((pre, cur) => {
        return  (cur.top + cur.height) - (pre.top + pre.height)
      })
      const top1Ele = elements[0]
      const top2Ele = elements[1]

      if (top2Ele.top + top2Ele.height > top1Ele.top) {
        value.topEle = top1Ele
        value.topSpace = ele.top - (top1Ele.top + top1Ele.height)
        return true
      }
      value.topEle = top1Ele
      value.topSpace = ele.top - (top1Ele.top + top1Ele.height)
      return false
    }
  }

  checkLeftIntersects(elements, ele, value) {
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.leftEle = cEle
        value.leftSpace = ele.left - (cEle.left + cEle.width)
      }
      return false
    } else {
      elements.sort((pre, cur) => {
        return (cur.left + cur.width) - (pre.left + pre.width)
      })
      const top1Ele = elements[0]
      const top2Ele = elements[1]

      if (top2Ele.left + top2Ele.width > top1Ele.left) {
        value.leftEle = top1Ele
        value.leftSpace = ele.left - (top1Ele.left + top1Ele.width)
        return true
      }
      value.leftEle = top1Ele
      value.leftSpace = ele.left - (top1Ele.left + top1Ele.width)
      return false
    }
  }

  handleAdjacent(elements) {
    const eleIdToInfo = {}
    const eleIdMap = {}
    elements.forEach((ele => {
      eleIdMap[ele.id] = ele
      const rightEles = []
      const bottomEles = []

      const haslog = false

      for (let i = 0; i < elements.length; i++) {
        const cEle = elements[i]
        if (!eleIdToInfo[cEle.id]) {
          eleIdToInfo[cEle.id] = {
            topEles: [],
            leftEles: [],
            rightEles: [],
            bottomEles: []
          }
        }

        if (ele.id !== cEle.id) {
          const break1 = cEle.left >= ele.left + ele.width && cEle.top >= ele.top + ele.height
          // 被对比的在右下角就不用管了
          if (break1) {
            // break
          }
          if (break1 || (cEle.left + cEle.width <= ele.left || cEle.top + cEle.height <= ele.top)) {

          } else {
           
            // 先看是上下还是左右
            if (cEle.top >= ele.top + ele.height) {
              // 上下对比
              // 找是否有相同区间的
              // let sLeft = 0
              // let mWidth = 0
              // const { left: cLeft, width: cWidth } = cEle
              // let sIdx = -1
              // bottomEles.forEach(({left, width}, idx) => {
              //   if (left < sLeft) {
              //     sLeft = left
              //   }
              //   if (mWidth < left + width) {
              //     mWidth = left + width
              //   }
                
              //   if ((cLeft >= left && cLeft < left + width) || (cLeft + cWidth <= left + width && cLeft + cWidth > left)) {
              //     sIdx = idx
              //     // return true
              //   }
              //   // return false
              // })

              // if (sIdx === -1) {
              //   if (cEle.id === 'J') {
              //     console.log("检测上下左右,", cEle.id, ele.id, sIdx, JSON.parse(JSON.stringify(bottomEles)))
              //     console.log({sLeft, mWidth})
              //   }
  
              //   // 说明没有相交的，当前下侧直接push
              //   bottomEles.push(cEle)
              //   // 向被对比的上侧添加
              //   eleIdToInfo[cEle.id].topEles.push(ele)
              //   // TODO:看是否考虑在这里就把关系做好
              // } else {
              //   // sIdx 说明相交了，对比top，看谁更近
              //   const sEle = bottomEles[sIdx]
              //   if (cEle.top < sEle.top) {
              //     // 当前更小，替换
              //     bottomEles.splice(sIdx, 1, cEle)
              //     // 向被对比的上侧添加
              //     eleIdToInfo[cEle.id].topEles.push(ele)
              //     // 把相同的上侧删除当前元素
              //     const sEleTopEles = eleIdToInfo[sEle.id].topEles
              //     const sEleTopIdx = sEleTopEles.findIndex((e) => e.id === ele.id)
              //     if (sEleTopIdx !== -1) {
              //       sEleTopEles.splice(sEleTopIdx, 1)
              //     }
              //   } else {
              //     // 当前更大，不做处理
              //   }
              // }

              // if (!bottomEles.length) {
              //   // 没有，直接push
              //   bottomEles.push(cEle)
              //   eleIdToInfo[cEle.id].topEles.push(ele)
              // } else {
              //   const hasNoPush = bottomEles.some(({left, width}) => {
              //     return (cEle.left >= left && cEle.left <= left + width) || 
              //       (cEle.left + cEle.width >= left && cEle.left + cEle.width <= left + width) ||
              //       (left >= cEle.left && left <= cEle.left + cEle.width) ||
              //       (left + width >= cEle.left && left + width <= cEle.left + cEle.width)
              //   })

              //   if (!hasNoPush) {
              //     bottomEles.push(cEle)
              //     eleIdToInfo[cEle.id].topEles.push(ele)
              //   }
              // }

             

              bottomEles.push(cEle)
              eleIdToInfo[cEle.id].topEles.push(ele)

            } else {
              // 左右对比
              // console.log("左右对比: ", ele.id, cEle.id)
              // 找是否有相同区间的
              const sIdx = rightEles.findIndex(({top, height}) => {
                const { top: cTop, height: cHeight } = cEle
                if ((cTop >= top && cTop < top + height) || (cTop + cHeight <= top + height && cTop + cHeight > top)) {
                  return true
                }
                return false
              })

              if (sIdx === -1) {
                // 说明没有相交的，当前右侧直接push
                rightEles.push(cEle)
                // 向被对比的左侧添加
                eleIdToInfo[cEle.id].leftEles.push(ele)
                // TODO:看是否考虑在这里就把关系做好
              } else {
                // sIdx 说明相交了，对比left，看谁更近
                const sEle = rightEles[sIdx]
                if (cEle.left < sEle.left) {
                  // 当前更小，替换
                  rightEles.splice(sIdx, 1, cEle)
                  // 向被对比的左侧添加
                  eleIdToInfo[cEle.id].leftEles.push(ele)
                  // 把相同的左侧删除当前元素
                  const sEleLeftEles = eleIdToInfo[sEle.id].leftEles
                  const sEleLeftIdx = sEleLeftEles.findIndex((e) => e.id === ele.id)
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

      eleIdToInfo[ele.id].rightEles = rightEles
      eleIdToInfo[ele.id].bottomEles = bottomEles
    }))

    Object.entries(eleIdToInfo).forEach(([key, value]: any) => {
      // console.log("key: ", key)
      value.rightIntersect = this.checkRightIntersects(value.rightEles, eleIdMap[key], value)
      value.bottomIntersect = this.checkBottomIntersects(value.bottomEles, eleIdMap[key], value)
      value.topIntersect = this.checkTopIntersects(value.topEles, eleIdMap[key], value)
      value.leftIntersect = this.checkLeftIntersects(value.leftEles, eleIdMap[key], value)
    })

    return eleIdToInfo
  }


  newSplitElements({elements, eleIdToInfo}) {
    const intersectMap = {
      bottomSpace: 'bottomIntersect',
      topSpace: 'topIntersect',
      leftSpace: 'leftIntersect',
      rightSpace: 'rightIntersect',
    }
    const eleMap = {
      bottomSpace: 'bottomEle',
      topSpace: 'topEle',
      leftSpace: 'leftEle',
      rightSpace: 'rightEle',
    }
    const eleGroup = []
    const eleIdToPosition = {}

    function sortEles({ele, eleInfo, fEle, fEleInfo, direction}) {
      let eles
      let idxMap = {}
      let space
      let comparable = true

      if (direction === 'bottomSpace') {
        // 说明fEle在ele下面
        eles = [ele, fEle]
        idxMap[ele.id] = 0
        idxMap[fEle.id] = 1
        space = fEle.top - (ele.top + ele.height)
        comparable = !fEleInfo.topIntersect
      } else if (direction === 'bottomSpace') {
        // 说明fEle在ele上面
        eles = [fEle, ele]
        idxMap[fEle.id] = 0
        idxMap[ele.id] = 1
        space = ele.top - (fEle.top + fEle.height)
        comparable = !fEleInfo.topIntersect
      } else if (direction === 'leftSpace') {
        // 说明fEle在ele左面
        eles = [fEle, ele]
        idxMap[fEle.id] = 0
        idxMap[ele.id] = 1
        space = ele.left - (fEle.left + fEle.width)
        comparable = !fEleInfo.rightIntersect
      } else if (direction === 'rightSpace') {
        // 说明fEle在ele右面
        eles = [ele, fEle]
        idxMap[ele.id] = 0
        idxMap[fEle.id] = 1
        space = fEle.left - (ele.left + ele.width)
        comparable = !fEleInfo.leftIntersect
      }
      
      return {
        eles,
        idxMap,
        space,
        comparable
      }
    }

    elements.forEach((ele) => {
      const eleInfo = eleIdToInfo[ele.id]
      const spaceAry = ['rightSpace', 'bottomSpace', 'topSpace', 'leftSpace'].filter((key) => {
        if (eleInfo.hasOwnProperty(key)) {
          return true
        }
      }).sort((p, c) => {
        return eleInfo[p] - eleInfo[c]
      })
      if (!spaceAry.length) {
        eleGroup.push([ele])
        eleIdToPosition[ele.id] = {
          idx1: eleGroup.length - 1,
          idx2: 0
        }
      } else {
        let isBreak = false
        const elePo = eleIdToPosition[ele.id]
        for (let i = 0; i < spaceAry.length; i++) {
          const key = spaceAry[i]
          const intersect = eleInfo[intersectMap[key]]
          const fEle = eleInfo[eleMap[key]]
          const fElePo = eleIdToPosition[fEle.id]
          const fEleInfo = eleIdToInfo[fEle.id]

          if (!intersect) {
            // 没有相交
            if (!elePo) {
              // 没有当前
              if (!fElePo) {
                // 没有被对比
                // console.log(`✅ 没有相交 没有-当前${ele.id} 没有-被对比${fEle.id}`) // 直接push合并即可
                const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})

                if (comparable) {
                  eleGroup.push(eles)
                  eleIdToPosition[ele.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: idxMap[ele.id]
                  }
                  eleIdToPosition[fEle.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: idxMap[fEle.id]
                  }
                  isBreak = true
                  break
                }
              } else {
                const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})
                if (comparable) {
                  if (space < fElePo.space) {
                    // console.log(`✅ 没有相交 间距更小 没有-当前${ele.id} 有-被对比${fEle.id}`)
                    // 删除被对比
                    eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                    // 和被对比成组
                    eleGroup.push(eles)
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[ele.id]
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[fEle.id]
                    }
                    isBreak = true
                    break
                  } else {
                    // 间距更大，忽略 TODO: 如果间距相同，左右成组
                    // console.log(999, {
                    //   ele,
                    //   elePo,
                    //   eleInfo,
                    //   fEle,
                    //   fElePo,
                    //   fEleInfo,
                    //   space,
                    //   fSpace: fElePo.space
                    // })
                  }
                }
              }
            } else {
              if (!fElePo) {
                // 没有被对比
                const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})
                if (comparable) {
                  if (space < elePo.space) {
                    // console.log(`✅ 没有相交 间距更小 有-当前${ele.id} 没有-被对比${fEle.id}`)
                    // 删除当前
                    eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                    // 和被对比成组
                    eleGroup.push(eles)
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[ele.id]
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[fEle.id]
                    }
                    isBreak = true
                    break
                  } else {
                    // 间距更大，忽略 TODO: 如果间距相同，左右成组
                  }
                }
              } else {
                // 有被对比
                if (elePo.idx1 === fElePo.idx1) {
                  // 在同一组
                  isBreak = true
                  break
                } else {
                  const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})
                  if (comparable) {
                    if (space < fElePo.space) {
                      // console.log(`✅ 没有相交 间距更小 有-当前${ele.id} 有-被对比${fEle.id}`)
                      // 删除当前
                      eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                      // 删除被对比
                      eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                      // 和被对比成组
                      eleGroup.push(eles)
                      eleIdToPosition[ele.id] = {
                        space,
                        idx1: eleGroup.length - 1,
                        idx2: idxMap[ele.id]
                      }
                      eleIdToPosition[fEle.id] = {
                        space,
                        idx1: eleGroup.length - 1,
                        idx2: idxMap[fEle.id]
                      }
                      isBreak = true
                      break
                    } else {
                      // 间距更大，忽略 TODO: 如果间距相同，左右成组
                    }
                  }
                }
              }
            }
          } else {
            // 相交的话直接忽略即可
          }
        }
        if (!isBreak) {
          // console.log(`✅ 单独 ${ele.id}`)
          eleGroup.push([ele])
          eleIdToPosition[ele.id] = {
            idx1: eleGroup.length - 1,
            idx2: 0
          }
        }
      }
    })

    return eleGroup
  }

  // 拆分2
  splitElements2(elements: any) {
    const eleIdToInfo = this.handleAdjacent(elements.sort((pre, cur) => {
      if (pre.top === cur.top) {
        return pre.left - cur.left
      }
      return pre.top - cur.top
    }))

    const eleGroup = this.newSplitElements({elements: elements.sort((pre, cur) => {
      if (pre.top === cur.top) {
        return pre.left - cur.left
      }
      return pre.top - cur.top
    }), eleIdToInfo})


    let newElements = this.convertedToElements(eleGroup)

    if (elements.length === newElements.length) {
      // 处理后长度相同
      // 默认为不同行

      let minLeft = Infinity, minTop = Infinity, maxHeight = 0, maxWdith = 0, id = ''
      const lastIndex = newElements.length - 1
      newElements.forEach((ele, index) => {
        id = id + ele.id + `${index === lastIndex ? '' : ','}`
        ele.parentFlexDirection = 'column'
        
        if (ele.top < minTop) {
          minTop = ele.top
        }
        if (ele.left < minLeft) {
          minLeft = ele.left
        }
        if (ele.top + ele.height > maxHeight) {
          maxHeight = ele.top + ele.height
        }
        if (ele.left + ele.width > maxWdith) {
          maxWdith = ele.left + ele.width
        }
      })

      return [{
        id,
        flexDirection: 'column',
        elements: newElements,
        top: minTop,
        left: minLeft,
        height: maxHeight - minTop,
        width: maxWdith - minLeft
      }]
    }

    if (newElements.length > 1) {
      return this.splitElements2(newElements)
    }

    return newElements
  }

  convertedToElements(eleGroup: any) {
    const elements = []

    eleGroup.forEach((group) => {
      const length = group.length
      // console.log("group: ", group.map((i) => i.id))
      if (length) {
        if (length === 1) {
          // elements.push(group[0])
          const ele = group[0]
          if (ele.flexDirection) {
            elements.push(ele)
          } else {
            if (ele.tempElements) {
              elements.push(ele)
            } else {
              elements.push({
                ...ele,
                tempElements: [ele]
              })
            }
          }
        } else if (length > 1) {
          // 找最小的top，最小的left，计算最大的width和height
          let top,left,width,height
          let flexDirection
          let curLeft = 0
          let curTop = 0
          // console.log(":group", group.map((i) => i.id))
          // group.sort((pre, cur) => {
          //   if (pre.top === cur.top) {
          //     return pre.left - cur.left
          //   }
          //   return pre.top - cur.top
          // })
          group.forEach((ele) => {
            if (typeof top !== 'number' || top > ele.top) {
              top = ele.top
            }
            if (typeof left !== 'number' || left > ele.left) {
              left = ele.left
            }
            if (typeof width !== 'number' || width < ele.width + ele.left) {
              width = ele.width + ele.left
            }
            if (typeof height !== 'number' || height < ele.height + ele.top) {
              height = ele.height + ele.top
            }

            if (ele.top >= curTop) {
              flexDirection = 'column'
            } else if (ele.left >= curLeft) {
              flexDirection = 'row'
            }
           

            // if (curLeft <= ele.left) {
            //   flexDirection = 'row'
            // }
            curLeft = ele.left + ele.width
            curTop = ele.top + ele.height
          })

          elements.push({
            // 方便看数据，后续去掉
            id: group.map((i) => i.id).join(),
            top,
            left,
            width: width - left,
            height: height - top,
            flexDirection: flexDirection || 'column',
            elements: group.map((g) => {
              if (g.flexDirection) {
                return {
                  ...g,
                  parentFlexDirection: flexDirection || 'column',
                }
              } else {
                if (g.tempElements) {
                  return {
                    ...g,
                    parentFlexDirection: flexDirection || 'column',
                  }
                }
                return {
                  ...g,
                  parentFlexDirection: flexDirection || 'column',
                  tempElements: [g]
                }
              }
            })
          })
        }
      }
    })

    return elements
  }
}

/**
 * - elementA 被对比
 * - elementB 对比
 */
function checkElementRelationship(elementA: any, elementB: any) {
  const { width: a_width, height: a_height, top: a_top, left: a_left } = elementA
  const { width: b_width, height: b_height, top: b_top, left: b_left } = elementB

  // 仅包含了
  if (
    a_width + a_left >= b_width + b_left && // 右侧包含
    a_top <= b_top && // 上侧包含
    a_left <= b_left && // 左侧包含
    a_height + a_top >= b_height + b_top // 下侧包含
  ) {
    return 'include'
  }

  if (
    (b_left >= a_left && (b_left < a_left + a_width) && (b_top >= a_top) && b_top <= (a_top + a_height)) && !(b_top === a_top || b_top === (a_top + a_height)) || // 左上角
    (b_left > a_left && (b_left < a_left + a_width) && (a_top <= b_top + b_height) && (b_top + b_height <= a_top + a_height)) || // 左下角
    ((b_left + b_width > a_left) && (b_left + b_width < a_left + a_width) && (b_top > a_top) && b_top < (a_top + a_height)) || // 右上角
    ((b_left + b_width > a_left) && (b_left + b_width < a_left + a_width) && (b_top + b_height > a_top) && (b_top + b_height < a_top + a_height)) // 右下角
  ) {
    return 'intersect'
  }

  return
}