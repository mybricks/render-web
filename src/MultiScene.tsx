import React, {
  useMemo,
  useState,
  useCallback
} from 'react'

import Main from './Main'

import lazyCss from './MultiScene.lazy.less'

const css = lazyCss.locals

export default function MultiScene ({json, opts}) {
  const [count, setCount] = useState(0)

  const {scenesMap} = useMemo(() => {
    if (opts.sceneId) {
      const index = json.scenes.findIndex((scenes) => scenes.id === opts.sceneId)
      if (index !== -1) {
        const scene = json.scenes.splice(index, 1)
        json.scenes.unshift(...scene)
      }
    }
    return {
      scenesMap: json.scenes.reduce((acc, json, index) => {
        return {
          ...acc,
          [json.id]: {
            show: index === 0,
            todo: [],
            json,
            disableAutoRun: !!index,
            useEntryAnimation: false,
            type: json.slot?.showType || json.type
          }
        }
      }, {}),
    }
  }, [])

  useMemo(() => {
    if (opts.ref) {
      const ref = opts.ref
      opts.ref = (cb) => (_refs) => {
        cb(_refs)
        return ref.call(opts, _refs)
      }
    } else {
      opts.ref = (cb) => (_refs) => {
        cb(_refs)
      }
    }
  }, [])

  const {fxFramesMap, fxFramesJsx} = useMemo(() => {
    const fxFramesMap = {}
    const fxFramesJsx: any = []
    const { global } = json
    if (global) {
      const { fxFrames } = global
      if (Array.isArray(fxFrames)) {
        fxFrames.forEach((fxFrame) => {
          const { id } = fxFrame
          const fxInfo: any = {}
          fxFramesMap[id] = fxInfo
          const options = {
            ...opts,
            env: {
              ...opts.env,
              canvas: {
                id,
                type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
                open: (sceneId, params, openType) => {
                  // console.log(`fx canvas.open 打开场景 -> ${sceneId}`)
                  const scenes = scenesMap[sceneId]
        
                  if (openType) {
                    Object.entries(scenesMap).forEach(([key, scenes]: any) => {
                      if (key === sceneId) {
                        if (openType === 'blank') {
                          scenes.useEntryAnimation = true
                        } else {
                          scenes.useEntryAnimation = false
                        }
                        scenes.show = true
                      } else {
                        scenes.show = false
                      }
                    })
                    setCount((count) => count+1)
                  } else {
                    if (!scenes.show) {
                      if (openType === 'blank') {
                        scenes.useEntryAnimation = true
                      } else {
                        scenes.useEntryAnimation = false
                      }
                      scenes.show = true
                      setCount((count) => count+1)
                    }
                  }
                }
              },
              // 这个在下版本去除
              openScene: (sceneId, params, openType) => {
                // console.log(`fx openScene 打开场景 -> ${sceneId}`)
                const scenes = scenesMap[sceneId]
      
                if (!scenes.show) {
                  scenes.show = true
                  setCount((count) => count+1)
                }
              }
            },
            disableAutoRun: true,
            ref: opts.ref((_refs) => {
              // console.log(`fx 场景注册_refs -> ${id}`)

              fxInfo._refs = _refs
              
              // scenes._refs = _refs
              // const todo = scenes.todo
              const { inputs, outputs } = _refs

              fxFrame.outputs.forEach((output) => {
                outputs(output.id, (value) => {
                  fxInfo.parentScope?.outputs[output.id](value)
                })
              })
      
              // scenes.json.outputs.forEach((output) => {
              //   outputs(output.id, (value) => {
              //     scenes.show = false
              //     scenes.todo = []
              //     scenes._refs = null
              //     scenes.parentScope?.outputs[output.id](value)
              //     scenes.parentScope = null
              //     setCount((count) => count+1)
              //   })
              // })
      
              // if (todo.length) {
              //   todo.forEach(({type, todo}) => {
              //     if (type === 'inputs') {
              //       Promise.resolve().then(() => {
              //         inputs[todo.pinId](todo.value)
              //       })
              //     } else if (type === 'globalVar') {
              //       const { comId, value, bindings } = todo
              //       _notifyBindings(_refs, comId, bindings, value)
              //     }
              //   })
        
              //   scenes.todo = []
              // } else if (!disableAutoRun) {
              //   Promise.resolve().then(() => {
              //     scenes.json.inputs?.forEach?.(({id}) => {
              //       inputs[id](void 0)
              //     })
              //   })
              // }
      
              // if (disableAutoRun) {
              //   Promise.resolve().then(() => {
              //     _refs.run()
              //   })
              // }
            }),
            _env: {
              loadCSSLazy() {},
              currentScenes: {
                close() {
                  // console.log('fx currentScenes.close')
                  // scenes.show = false
                  // scenes.todo = []
                  // scenes._refs = null
                  // scenes.parentScope = null
                  // setCount((count) => count+1)
                }
              }
            },
            scenesOperate: {
              open({todo, frameId, parentScope}) {
                // console.log('fx scenesOperate.open', {
                //   todo,
                //   frameId,
                //   parentScope
                // })
                const fxFrame = fxFramesMap[frameId]

                if (fxFrame?._refs) {
                  fxFrame.parentScope = parentScope
                  fxFrame._refs.inputs[todo.pinId](todo.value)
                  fxFrame._refs.run()
                }
                // const scenes = scenesMap[frameId]
      
                // if (!scenes.show) {
                //   scenes.show = true
                //   scenes.todo = scenes.todo.concat({type: 'inputs', todo})
                //   scenes.parentScope = parentScope
        
                //   setCount((count) => count+1)
                // }
              },
              inputs({frameId, parentScope, value, pinId}) {
                // console.log('fx 场景触发inputs: ', {
                //   frameId, parentScope, value, pinId
                // })
                const scenes = scenesMap[frameId]
      
                scenes.parentScope = parentScope
      
                if (scenes._refs) {
                  scenes._refs.inputs[pinId](value)
                } else {
                  scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
                    pinId,
                    value
                  }})
                }
              },
              _notifyBindings(val, com) {
                const { bindingsTo } = com.model
                if (bindingsTo) {
                  for (let comId in bindingsTo) {
                    for (let i in scenesMap) {
                      const scenes = scenesMap[i]
                      const com = scenes.json.coms[comId]
                      
                      if (com) {
                        if (scenes._refs) {
                          _notifyBindings(scenes._refs, comId, bindingsTo[comId], val)
                        } else {
                          const bindings = bindingsTo[comId]
                          scenes.todo = scenes.todo.concat({type: 'globalVar', todo: {comId, bindings, value: val}})
                        }
                      }
                    }
                  }
                }
              },
              getGlobalComProps(comId) {
                // 从主场景获取真实数据
                return scenesMap[json.scenes[0].id]._refs.get(comId)
              }
            }
          }

          let coms = global.comsReg
          let cons = global.consReg
          let pinRels = global.pinRels

          Object.keys(coms).forEach((key) => {
            coms[key].global = true
          })

          Object.assign(fxFrame.coms, coms)
          Object.assign(fxFrame.cons, cons)
          Object.assign(fxFrame.pinRels, pinRels)

          fxFramesJsx.push(<Main key={id} json={{...fxFrame, rtType: 'js'}} opts={options}/>)
        })
      }
    }

    return {
      fxFramesMap,
      fxFramesJsx
    }
  }, [])

  const options = useCallback((id) => {
    const scenes = scenesMap[id]
    const { disableAutoRun } = scenes

    return {
      ...opts,
      env: {
        ...opts.env,
        canvas: {
          id,
          type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
          open: (sceneId, params, openType) => {
            // console.log(`打开场景 -> ${sceneId}`)
            const scenes = scenesMap[sceneId]
  
            if (openType) {
              Object.entries(scenesMap).forEach(([key, scenes]: any) => {
                if (key === sceneId) {
                  if (openType === 'blank') {
                    scenes.useEntryAnimation = true
                  } else {
                    scenes.useEntryAnimation = false
                  }
                  scenes.show = true
                } else {
                  scenes.show = false
                }
              })
              setCount((count) => count+1)
            } else {
              if (!scenes.show) {
                if (openType === 'blank') {
                  scenes.useEntryAnimation = true
                } else {
                  scenes.useEntryAnimation = false
                }
                scenes.show = true
                setCount((count) => count+1)
              }
            }
          }
        },
        // 这个在下版本去除
        openScene: (sceneId, params, openType) => {
          // console.log(`打开场景 -> ${sceneId}`)
          const scenes = scenesMap[sceneId]

          if (!scenes.show) {
            scenes.show = true
            setCount((count) => count+1)
          }
        }
      },
      disableAutoRun,
      ref: opts.ref((_refs) => {
        // console.log(`场景注册_refs -> ${id}`)
        scenes._refs = _refs
        const todo = scenes.todo
        const { inputs, outputs } = _refs

        scenes.json.outputs.forEach((output) => {
          outputs(output.id, (value) => {
            scenes.show = false
            scenes.todo = []
            scenes._refs = null
            scenes.parentScope?.outputs[output.id](value)
            scenes.parentScope = null
            setCount((count) => count+1)
          })
        })

        if (todo.length) {
          todo.forEach(({type, todo}) => {
            if (type === 'inputs') {
              Promise.resolve().then(() => {
                inputs[todo.pinId](todo.value,id)
              })
            } else if (type === 'globalVar') {
              const { comId, value, bindings } = todo
              _notifyBindings(_refs, comId, bindings, value)
            }
          })
  
          scenes.todo = []
        } else if (!disableAutoRun) {
          Promise.resolve().then(() => {
            scenes.json.inputs?.forEach?.(({id}) => {
              inputs[id](void 0)
            })
          })
        }

        if (disableAutoRun) {
          Promise.resolve().then(() => {
            _refs.run()
          })
        }
      }),
      _env: {
        loadCSSLazy() {},
        currentScenes: {
          close() {
            scenes.show = false
            scenes.todo = []
            scenes._refs = null
            // scenes.parentScope = null
            setCount((count) => count+1)
          }
        }
      },
      scenesOperate: {
        open({todo, frameId, parentScope}) {
          const scenes = scenesMap[frameId]

          if (scenes) {
            if (!scenes.show) {
              scenes.show = true
              scenes.todo = scenes.todo.concat({type: 'inputs', todo})
              scenes.parentScope = parentScope
    
              setCount((count) => count+1)
            }
          } else {
            const fxFrame = fxFramesMap[frameId]
            if (fxFrame?._refs) {
              fxFrame.parentScope = parentScope
              fxFrame._refs.inputs[todo.pinId](todo.value)
              fxFrame._refs.run()
            }
          }
        },
        inputs({frameId, parentScope, value, pinId}) {
          // console.log('场景触发inputs: ', {
          //   frameId, parentScope, value, pinId
          // })
          const scenes = scenesMap[frameId]

          scenes.parentScope = parentScope

          if (scenes._refs) {
            scenes._refs.inputs[pinId](value)
          } else {
            scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
              pinId,
              value
            }})
          }
        },
        _notifyBindings(val, com) {
          const { bindingsTo } = com.model
          if (bindingsTo) {
            for (let comId in bindingsTo) {
              for (let i in scenesMap) {
                const scenes = scenesMap[i]
                const com = scenes.json.coms[comId]
                
                if (com) {
                  if (scenes._refs) {
                    _notifyBindings(scenes._refs, comId, bindingsTo[comId], val)
                  } else {
                    const bindings = bindingsTo[comId]
                    scenes.todo = scenes.todo.concat({type: 'globalVar', todo: {comId, bindings, value: val}})
                  }
                }
              }
            }
          }
        },
        getGlobalComProps(comId) {
          // 从主场景获取真实数据
          return scenesMap[json.scenes[0].id]._refs.get(comId)
        }
      }
    }
  }, [])

  const scenes = useMemo(() => {
    const { global } = json
    let coms = {}
    let cons = {}
    let pinRels = {}

    if (global) {
      coms = global.comsReg
      cons = global.consReg
      pinRels = global.pinRels

      Object.keys(coms).forEach((key) => {
        coms[key].global = true
      })
    }

    return json.scenes.map((json, index) => {
      const { id } = json
      Object.assign(json.coms, coms)
      Object.assign(json.cons, cons)
      Object.assign(json.pinRels, pinRels)
      const scene = scenesMap[id]
      
      return scene.show && <Scene key={json.id} json={{...json, scenesMap}} opts={options(id)} className={scene.useEntryAnimation ? css.main : ''} style={scene.type === 'popup' ? {position: 'absolute', top: 0, left: 0} : {}}/>
    })
  }, [count])

  return (
    <>
      {fxFramesJsx}
      {scenes}
    </>
  )
}

function Scene({json, opts, style = {}, className = ''}) {
  return (
    <Main json={json} opts={opts} style={style} className={className}/>
  )
}

function _notifyBindings(_refs, comId, bindings, value) {
  const com = _refs.get(comId)
  if (com) {
    if (Array.isArray(bindings)) {
      bindings.forEach((binding) => {
        let nowObj = com
        const ary = binding.split('.')
        ary.forEach((nkey, idx) => {
          if (idx !== ary.length - 1) {
            nowObj = nowObj[nkey]
          } else {
            nowObj[nkey] = value
          }
        })
      })
    }
  }
}
