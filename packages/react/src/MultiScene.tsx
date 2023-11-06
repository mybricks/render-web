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
  const [popupIds, setPopupIds] = useState<any>([])
  const [pageScenes, setPageScenes] = useState<any>([])

  const {scenesMap, scenesOperateInputsTodo, themes, permissions, globalVarMap} = useMemo(() => {
    if (opts.sceneId) {
      const index = json.scenes.findIndex((scenes) => scenes.id === opts.sceneId)
      if (index !== -1) {
        const scene = json.scenes.splice(index, 1)
        json.scenes.unshift(...scene)
        if (scene[0].type === 'popup') {
          setPopupIds([scene[0].id])
        }
      }
    }
    const pageScenes: any = []

    json.scenes.forEach((scene, index) => {
      if (scene.type === 'popup') {
        if (!index) {
          setPopupIds([scene.id])
        }
      } else {
        pageScenes.push(scene)
      }
    })

    setPageScenes(pageScenes)

    const { modules, definedComs } = json

    if (!opts.env.getDefinedComJSON) {
      opts.env.getDefinedComJSON = (definedId: string) => {
        return definedComs[definedId].json
      }
    }
    opts.env.getModuleJSON = (moduleId: string) => {
      const moduleJson = modules?.[moduleId]?.json
      if (!moduleJson) {
        return moduleJson
      }
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

      Object.assign(moduleJson.coms, coms)
      Object.assign(moduleJson.cons, cons)
      Object.assign(moduleJson.pinRels, pinRels)

      return moduleJson
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
      scenesOperateInputsTodo: {},
      themes: json.themes,
      permissions: json.permissions || [],
      globalVarMap: {}
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
          const { env } = opts
          env.canvas = Object.assign({
            id,
            type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
            open: async (sceneId, params, openType) => {
              // console.log(`fx canvas.open 打开场景 -> ${sceneId}`)
              let scenes = scenesMap[sceneId]
  
              if (!scenes) {
                if (typeof opts.scenesLoader !== 'function') {
                  console.error(`缺少场景信息: ${sceneId}`)
                  return
                }
                const json = await opts.scenesLoader({id: sceneId})
  
                scenes = {
                  disableAutoRun: false,
                  json,
                  show: false,
                  parentScope: null,
                  todo: [],
                  type: json.slot?.showType || json.type,
                  useEntryAnimation: false
                }
  
                scenesMap[sceneId] = scenes
                if (json.type === 'popup') {
                } else {
                  setPageScenes((pageScenes) => {
                    return [...pageScenes, json]
                  })
                }
                if (scenesOperateInputsTodo[sceneId]) {
                  const { parentScope, todo } = scenesOperateInputsTodo[sceneId]
                  scenes.parentScope = parentScope
                  todo.forEach(({value, pinId, parentScope}) => {
                    scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
                      pinId,
                      value
                    }})
                  })
                }
              }
    
              if (openType) {
                Object.entries(scenesMap).forEach(([key, scenes]: any) => {
                  if (key === sceneId) {
                    if (openType === 'blank') {
                      scenes.useEntryAnimation = true
                    } else {
                      scenes.useEntryAnimation = false
                    }
                    scenes.show = true
                    if (scenes.type === 'popup') {
                      setPopupIds((popupIds) => {
                        return [...popupIds, sceneId]
                      })
                    } else {
                      setCount((count) => count+1)
                    }
                  } else {
                    scenes.show = false
                    if (scenes.type === 'popup') {
                      setPopupIds((popupIds) => {
                        return popupIds.filter((id) => id !== scenes.json.id)
                      })
                    } else {
                      setCount((count) => count+1)
                    }
                  }
                })
              } else {
                if (!scenes.show) {
                  if (openType === 'blank') {
                    scenes.useEntryAnimation = true
                  } else {
                    scenes.useEntryAnimation = false
                  }
                  scenes.show = true
                  if (scenes.type === 'popup') {
                    setPopupIds((popupIds) => {
                      return [...popupIds, sceneId]
                    })
                  } else {
                    setCount((count) => count+1)
                  }
                }
              }
            }
          }, opts.env?.canvas)
          const scenesOperate = {
            open({todo, frameId, parentScope, comProps}) {
              // console.log('fx scenesOperate.open', {
              //   todo,
              //   frameId,
              //   parentScope
              // })
              const fxFrame = fxFramesMap[frameId]

              if (fxFrame?._refs) {
                fxFrame.parentScope = parentScope
                const configs = comProps?.data?.configs
                if (configs) {
                  Object.entries(configs).forEach(([key, value]) => {
                    fxFrame._refs.inputs[key](value, void 0, false)
                  })
                }
                fxFrame._refs.inputs[todo.pinId](todo.value, void 0, false)
                fxFrame._refs.run()
              }
            },
            inputs({frameId, parentScope, value, pinId}) {
              // console.log('fx 场景触发inputs: ', {
              //   frameId, parentScope, value, pinId
              // })
              const scenes = scenesMap[frameId]
              if (!scenes) {
                if (!scenesOperateInputsTodo[frameId]) {
                  scenesOperateInputsTodo[frameId] = {
                    parentScope,
                    todo: [{value, pinId}]
                  }
                } else {
                  scenesOperateInputsTodo[frameId].todo.push({frameId, parentScope, value, pinId})
                }
              } else {
                scenes.parentScope = parentScope
    
                if (scenes._refs) {
                  scenes._refs.inputs[pinId](value)
                } else {
                  scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
                    pinId,
                    value
                  }})
                }
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
              return scenesMap[json.scenes[0].id]._refs?.get(comId)
            },
            exeGlobalCom({ com, value, pinId }) {
              const globalComId = com.id
              globalVarMap[globalComId] = value
              Object.keys(scenesMap).forEach((key) => {
                const scenes = scenesMap[key]
                if (scenes.show && scenes._refs) {
                  const globalCom = scenes._refs.get(globalComId)
                  if (globalCom) {
                    globalCom.outputs[pinId](value, true, null, true)
                  }
                }
              })
              const refsMap = env._context.getRefsMap()
              Object.entries(refsMap).forEach(([id, refs]: any) => {
                const globalCom = refs.get(globalComId)
                  if (globalCom) {
                    globalCom.outputs[pinId](value, true, null, true)
                  }
              })
            }
          }
          env.scenesOperate = scenesOperate
          const options = {
            ...opts,
            env,
            // env: {
            //   ...opts.env,
            //   canvas: Object.assign({
            //     id,
            //     type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
            //     open: async (sceneId, params, openType) => {
            //       // console.log(`fx canvas.open 打开场景 -> ${sceneId}`)
            //       let scenes = scenesMap[sceneId]
      
            //       if (!scenes) {
            //         if (typeof opts.scenesLoader !== 'function') {
            //           console.error(`缺少场景信息: ${sceneId}`)
            //           return
            //         }
            //         const json = await opts.scenesLoader({id: sceneId})
      
            //         scenes = {
            //           disableAutoRun: false,
            //           json,
            //           show: false,
            //           parentScope: null,
            //           todo: [],
            //           type: json.slot?.showType || json.type,
            //           useEntryAnimation: false
            //         }
      
            //         scenesMap[sceneId] = scenes
            //         if (json.type === 'popup') {
            //         } else {
            //           setPageScenes((pageScenes) => {
            //             return [...pageScenes, json]
            //           })
            //         }
            //         if (scenesOperateInputsTodo[sceneId]) {
            //           const { parentScope, todo } = scenesOperateInputsTodo[sceneId]
            //           scenes.parentScope = parentScope
            //           todo.forEach(({value, pinId, parentScope}) => {
            //             scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
            //               pinId,
            //               value
            //             }})
            //           })
            //         }
            //       }
        
            //       if (openType) {
            //         Object.entries(scenesMap).forEach(([key, scenes]: any) => {
            //           if (key === sceneId) {
            //             if (openType === 'blank') {
            //               scenes.useEntryAnimation = true
            //             } else {
            //               scenes.useEntryAnimation = false
            //             }
            //             scenes.show = true
            //             if (scenes.type === 'popup') {
            //               setPopupIds((popupIds) => {
            //                 return [...popupIds, sceneId]
            //               })
            //             } else {
            //               setCount((count) => count+1)
            //             }
            //           } else {
            //             scenes.show = false
            //             if (scenes.type === 'popup') {
            //               setPopupIds((popupIds) => {
            //                 return popupIds.filter((id) => id !== scenes.json.id)
            //               })
            //             } else {
            //               setCount((count) => count+1)
            //             }
            //           }
            //         })
            //       } else {
            //         if (!scenes.show) {
            //           if (openType === 'blank') {
            //             scenes.useEntryAnimation = true
            //           } else {
            //             scenes.useEntryAnimation = false
            //           }
            //           scenes.show = true
            //           if (scenes.type === 'popup') {
            //             setPopupIds((popupIds) => {
            //               return [...popupIds, sceneId]
            //             })
            //           } else {
            //             setCount((count) => count+1)
            //           }
            //         }
            //       }
            //     }
            //   }, opts.env?.canvas),
            // },
            disableAutoRun: true,
            ref: opts.ref((_refs) => {
              // console.log(`fx 场景注册_refs -> ${id}`)

              fxInfo._refs = _refs

              const { inputs, outputs } = _refs

              fxFrame.outputs.forEach((output) => {
                outputs(output.id, (value) => {
                  fxInfo.parentScope?.outputs[output.id](value)
                })
              })
            }),
            _env: {
              loadCSSLazy() {},
              currentScenes: {
                close() {

                }
              }
            },
            scenesOperate
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
    const hasPermission = opts.env.hasPermission
    const { env } = opts
    env.themes = themes
    env.permissions = permissions
    if (typeof hasPermission === 'function') {
      Object.defineProperty(env, 'hasPermission', {
        get: function() {
          return (value) => {
            // TODO 兼容老的组件用法
            if (typeof value === 'string') {
              const permission = permissions.find((permission) => permission.id === value)
              return hasPermission({ permission })
            }
            return hasPermission(value)
          }
        }
      })
    }

    // env.hasPermission = typeof hasPermission === 'function' ? (value) => {
    //   // TODO 兼容老的组件用法
    //   if (typeof value === 'string') {
    //     const permission = permissions.find((permission) => permission.id === value)
    //     return hasPermission({ permission })
    //   }
    //   return hasPermission(value)
    // } : null
    env.canvas = Object.assign({
      id,
      type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
      open: async (sceneId, params, openType) => {
        // console.log(`打开场景 -> ${sceneId}`)
        let scenes = scenesMap[sceneId]

        if (!scenes) {
          if (typeof opts.scenesLoader !== 'function') {
            console.error(`缺少场景信息: ${sceneId}`)
            return
          }
          const json = await opts.scenesLoader({id: sceneId})

          scenes = {
            disableAutoRun: false,
            json,
            show: false,
            parentScope: null,
            todo: [],
            type: json.slot?.showType || json.type,
            useEntryAnimation: false
          }

          scenesMap[sceneId] = scenes
          if (json.type === 'popup') {
          } else {
            setPageScenes((pageScenes) => {
              return [...pageScenes, json]
            })
          }
          if (scenesOperateInputsTodo[sceneId]) {
            const { parentScope, todo } = scenesOperateInputsTodo[sceneId]
            scenes.parentScope = parentScope
            todo.forEach(({value, pinId, parentScope}) => {
              scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
                pinId,
                value
              }})
            })
          }
        }

        if (openType) {
          Object.entries(scenesMap).forEach(([key, scenes]: any) => {
            if (key === sceneId) {
              if (openType === 'blank') {
                scenes.useEntryAnimation = true
              } else {
                scenes.useEntryAnimation = false
              }
              scenes.show = true
              if (scenes.type === 'popup') {
                setPopupIds((popupIds) => {
                  return [...popupIds, sceneId]
                })
              } else {
                setCount((count) => count+1)
              }
            } else {
              scenes.show = false
              if (scenes.type === 'popup') {
                setPopupIds((popupIds) => {
                  return popupIds.filter((id) => id !== scenes.json.id)
                })
              } else {
                setCount((count) => count+1)
              }
            }
          })
        } else {
          if (!scenes.show) {
            if (openType === 'blank') {
              scenes.useEntryAnimation = true
            } else {
              scenes.useEntryAnimation = false
            }
            scenes.show = true
            if (scenes.type === 'popup') {
              setPopupIds((popupIds) => {
                return [...popupIds, sceneId]
              })
            } else {
              setCount((count) => count+1)
            }
          }
        }
      }
    }, opts.env?.canvas)

    const scenesOperate = {
      open({todo, frameId, parentScope, comProps}) {
        const scenes = scenesMap[frameId]

        if (scenes) {
          if (!scenes.show) {
            scenes.show = true
            scenes.todo = scenes.todo.concat({type: 'inputs', todo})
            scenes.parentScope = parentScope
  
            if (scenes.type === 'popup') {
              setPopupIds((popupIds) => {
                return [...popupIds, frameId]
              })
            } else {
              setCount((count) => count+1)
            }
          }
        } else {
          const fxFrame = fxFramesMap[frameId]
          if (fxFrame?._refs) {
            fxFrame.parentScope = parentScope
            const configs = comProps?.data?.configs
            if (configs) {
              Object.entries(configs).forEach(([key, value]) => {
                fxFrame._refs.inputs[key](value, void 0, false)
              })
            }
            fxFrame._refs.inputs[todo.pinId](todo.value, void 0, false)
            fxFrame._refs.run()
          }
        }
      },
      inputs({frameId, parentScope, value, pinId}) {
        // console.log('场景触发inputs: ', {
        //   frameId, parentScope, value, pinId
        // })
        const scenes = scenesMap[frameId]
        if (!scenes) {
          if (!scenesOperateInputsTodo[frameId]) {
            scenesOperateInputsTodo[frameId] = {
              parentScope,
              todo: [{value, pinId}]
            }
          } else {
            scenesOperateInputsTodo[frameId].todo.push({frameId, parentScope, value, pinId})
          }
        } else {
          scenes.parentScope = parentScope

          if (scenes._refs) {
            scenes._refs.inputs[pinId](value)
          } else {
            scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
              pinId,
              value
            }})
          }
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
        return scenesMap[json.scenes[0].id]._refs?.get(comId)
      },
      exeGlobalCom({ com, value, pinId }) {
        const globalComId = com.id
        globalVarMap[globalComId] = value
        Object.keys(scenesMap).forEach((key) => {
          const scenes = scenesMap[key]
          if (scenes.show && scenes._refs) {
            const globalCom = scenes._refs.get(globalComId)
            if (globalCom) {
              globalCom.outputs[pinId](value, true, null, true)
            }
          }
        })
        const refsMap = env._context.getRefsMap()
        Object.entries(refsMap).forEach(([id, refs]: any) => {
          const globalCom = refs.get(globalComId)
            if (globalCom) {
              globalCom.outputs[pinId](value, true, null, true)
            }
        })
      }
    }

    env.scenesOperate = scenesOperate

    return {
      ...opts,
      // env: {
      //   ...opts.env,
      //   themes,
      //   permissions,
      //   hasPermission: typeof hasPermission === 'function' ? (value) => {
      //     // TODO 兼容老的组件用法
      //     if (typeof value === 'string') {
      //       const permission = permissions.find((permission) => permission.id === value)
      //       return hasPermission({ permission })
      //     }
      //     return hasPermission(value)
      //   } : null,  
      //   canvas: Object.assign({
      //     id,
      //     type: window.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
      //     open: async (sceneId, params, openType) => {
      //       // console.log(`打开场景 -> ${sceneId}`)
      //       let scenes = scenesMap[sceneId]

      //       if (!scenes) {
      //         if (typeof opts.scenesLoader !== 'function') {
      //           console.error(`缺少场景信息: ${sceneId}`)
      //           return
      //         }
      //         const json = await opts.scenesLoader({id: sceneId})

      //         scenes = {
      //           disableAutoRun: false,
      //           json,
      //           show: false,
      //           parentScope: null,
      //           todo: [],
      //           type: json.slot?.showType || json.type,
      //           useEntryAnimation: false
      //         }

      //         scenesMap[sceneId] = scenes
      //         if (json.type === 'popup') {
      //         } else {
      //           setPageScenes((pageScenes) => {
      //             return [...pageScenes, json]
      //           })
      //         }
      //         if (scenesOperateInputsTodo[sceneId]) {
      //           const { parentScope, todo } = scenesOperateInputsTodo[sceneId]
      //           scenes.parentScope = parentScope
      //           todo.forEach(({value, pinId, parentScope}) => {
      //             scenes.todo = scenes.todo.concat({type: 'inputs', todo: {
      //               pinId,
      //               value
      //             }})
      //           })
      //         }
      //       }
  
      //       if (openType) {
      //         Object.entries(scenesMap).forEach(([key, scenes]: any) => {
      //           if (key === sceneId) {
      //             if (openType === 'blank') {
      //               scenes.useEntryAnimation = true
      //             } else {
      //               scenes.useEntryAnimation = false
      //             }
      //             scenes.show = true
      //             if (scenes.type === 'popup') {
      //               setPopupIds((popupIds) => {
      //                 return [...popupIds, sceneId]
      //               })
      //             } else {
      //               setCount((count) => count+1)
      //             }
      //           } else {
      //             scenes.show = false
      //             if (scenes.type === 'popup') {
      //               setPopupIds((popupIds) => {
      //                 return popupIds.filter((id) => id !== scenes.json.id)
      //               })
      //             } else {
      //               setCount((count) => count+1)
      //             }
      //           }
      //         })
      //       } else {
      //         if (!scenes.show) {
      //           if (openType === 'blank') {
      //             scenes.useEntryAnimation = true
      //           } else {
      //             scenes.useEntryAnimation = false
      //           }
      //           scenes.show = true
      //           if (scenes.type === 'popup') {
      //             setPopupIds((popupIds) => {
      //               return [...popupIds, sceneId]
      //             })
      //           } else {
      //             setCount((count) => count+1)
      //           }
      //         }
      //       }
      //     }
      //   }, opts.env?.canvas),
      // },
      env,
      get disableAutoRun() {
        return scenes.disableAutoRun
      },
      ref: opts.ref((_refs) => {
        // console.log(`场景注册_refs -> ${id}`)
        scenes._refs = _refs
        const todo = scenes.todo
        const { inputs, outputs } = _refs
        const disableAutoRun = scenes.disableAutoRun

        scenes.json.outputs.forEach((output) => {
          outputs(output.id, (value) => {
            // TODO: 临时，后续应该给场景一个回调
            if (output.id === 'apply') {
              scenes.parentScope?.outputs[output.id](value)
            } else {
              scenes.show = false
              scenes.todo = []
              scenes._refs = null
              scenes.parentScope?.outputs[output.id](value)
              scenes.parentScope = null
              if (scenes.type === 'popup') {
                setPopupIds((popupIds) => {
                  return popupIds.filter((id) => id !== scenes.json.id)
                })
              } else {
                setCount((count) => count+1)
              }
            }
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
          scenes.disableAutoRun = true
          Promise.resolve().then(() => {
            scenes.json.inputs?.forEach?.((input) => {
              const { id, mockData } = input
              let value = void 0
              if (opts.debug && typeof mockData !== 'undefined') {
                try {
                  value = JSON.parse(decodeURIComponent(mockData))
                } catch {
                  value = mockData
                }
              }
              inputs[id](value)
            })
          })
        }

        if (disableAutoRun) {
          Promise.resolve().then(() => {
            _refs.run()
          })
        }

        // Object.entries(globalVarMap).forEach(([ key, value ]) => {
        //   const globalCom = scenes._refs.get(key)
        //   if (globalCom) {
        //     globalCom.outputs['changed'](value, true, null, true)
        //   }
        // })
      }),
      _env: {
        loadCSSLazy() {},
        currentScenes: {
          close() {
            scenes.show = false
            scenes.todo = []
            scenes._refs = null
            // scenes.parentScope = null
            if (scenes.type === 'popup') {
              setPopupIds((popupIds) => {
                return popupIds.filter((id) => id !== scenes.json.id)
              })
            } else {
              setCount((count) => count+1)
            }
          }
        }
      },
      scenesOperate
    }
  }, [])

  const scenes = useMemo(() => {
    if (!pageScenes.length) {
      return null
    }
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

    return pageScenes.map((json, index) => {
      const { id } = json
      Object.assign(json.coms, coms)
      Object.assign(json.cons, cons)
      Object.assign(json.pinRels, pinRels)
      const scene = scenesMap[id]
      
      // @ts-ignore
      return scene.show && <Scene key={json.id} json={{...json, scenesMap}} opts={options(id)} className={scene.useEntryAnimation ? css.main : ''} style={scene.type === 'popup' ? {position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00'} : {}}/>
    })
  }, [count, pageScenes])

  const popups = useMemo(() => {
    if (popupIds.length) {
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

      return popupIds.map((sceneId) => {
        const scene = scenesMap[sceneId]
        const json = scene.json
        const { id } = json
        Object.assign(json.coms, coms)
        Object.assign(json.cons, cons)
        Object.assign(json.pinRels, pinRels)
        
        return <Scene key={json.id} json={{...json, scenesMap}} opts={options(id)} style={{position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00'}}/>
      })
    }
   
    return null
  }, [popupIds])

  return (
    <>
      {fxFramesJsx}
      {scenes}
      {popups}
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
