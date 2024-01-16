function transformJSON (json) {
  // console.log("render json: ", JSON.parse(JSON.stringify(json)))
  const { global, modules, scenes } = json

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
    if (modules) {
      Object.entries(modules).forEach(([key, module]: any) => {
        const { json } = module
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
      const { layoutTemplate } = scene.slot
      if (Array.isArray(layoutTemplate)) {
        // marginTop marginLeft 没有就是0
        // var layout = [
        //   { width: 200, height: 400, top: 0, left: 0, position: 'absolute', backgroundColor: 'red', value: 'A 200 x 400', children: [] }, // A
        //   { width: 200, height: 100, top: 0, left: 200, position: 'absolute', backgroundColor: 'black', value: 'B 200 x 100', children: [] }, // B
        //   { width: 100, height: 100, top: 100, left: 50, position: 'absolute', backgroundColor: 'aqua', value: 'G 200 x 400', children: [] }, // A
        //   { width: 200, height: 100, top: 100, left: 200, position: 'absolute', backgroundColor: 'yellow', value: 'C 200 x 100', children: [] }, // C
        //   { width: 100, height: 200, top: 200, left: 200, position: 'absolute', backgroundColor: 'pink', value: 'D 100 x 200', children: [] }, // D
        //   { width: 100, height: 200, top: 200, left: 300, position: 'absolute', backgroundColor: 'orange', value: 'E 100 x 200', children: [] }, // E
        //   { width: 400, height: 200, top: 400, left: 0, position: 'absolute', backgroundColor: 'green', value: 'F 400 x 200', children: [] }, // F
        // ]

        const preComAry = scene.slot.comAry
        const coms = scene.coms

        const traverseComAry = (comAry: any) => {
          const result = traverseElements(comAry)
          const depthTraversal = (items: any) => {
            items.forEach((item: any, index: any) => {
              if (item.type) {
                depthTraversal(item.items)
              } else {
                const id = item.id
                const children = item.children
                const modelStyle = coms[id].model.style
                modelStyle.position = 'relative'
                children.forEach((child: any, index: any) => {
                  const modelStyle = coms[child.id].model.style
                  modelStyle.position = 'absolute'
                  modelStyle.top = child.top
                  modelStyle.left = child.left
                  children[index] = preComAry.find((com: any) => com.id === child.id)
                })
                items[index] = {
                  ...preComAry.find((com: any) => com.id === id),
                  children
                }
              }
            })
          }

          depthTraversal(result)

          return result
        }

        const resultComAry = traverseComAry(layoutTemplate.map((item) => {
          const com = item.comAry[0]
          const style = com.style
          return {
            id: com.id,
            width: style.width,
            height: style.height,
            top: style.marginTop || 0,
            left: style.marginLeft || 0,
            children: []
          }
        }))

        scene.slot.layoutTemplate = resultComAry
      }
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
}