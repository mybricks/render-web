<template>
  <div>
    <component v-for="frame in fxFramesJsx" :key="frame.key" :is="frame.component" :json="frame.json" :opts="frame.options" />
    <Main
      v-for="scene in scenes"
      v-if="scene.show"
      :key="scene.key"
      :json="scene.json"
      :opts="scene.opts"
      :className="scene.className"
      :propsStyle="scene.style"
    />
    <Main
      v-for="popup in popups"
      :key="popup.key"
      :json="popup.json"
      :opts="popup.opts"
      :className="popup.className"
      :propsStyle="popup.style"
    />
  </div>
</template>

<script>
import Main from "./Main.vue";


export default {
  components: {
    Main,
  },
  props: {
    json: {
      type: Object,
    },
    opts: {
      type: Object
    },
  },
  data() {
    return {
      count: 0,
      popupIds: [],
      pageScenes: []
    }
  },
  created() {
    const { json, opts } = this.$props; 

    if (opts.sceneId) {
      const index = json.scenes.findIndex((scenes) => scenes.id === opts.sceneId)
      if (index !== -1) {
        const scene = json.scenes.splice(index, 1)
        json.scenes.unshift(...scene)
        if (scene[0].type === 'popup') {
          this.setPopupIds([scene[0].id])
        }
      }
    }
    const pageScenes = []

    json.scenes.forEach((scene, index) => {
      if (scene.type === 'popup') {
        if (!index) {
          this.setPopupIds([scene.id])
        }
      } else {
        pageScenes.push(scene)
      }
    })

    this.setPageScenes(pageScenes)

    this.scenesMap = json.scenes.reduce((acc, json, index) => {
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
    }, {});
    this.scenesOperateInputsTodo = {};
    this.themes = json.themes;
    this.permissions = json.permissions || [];
    this.globalVarMap = {};


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


    const fxFramesMap = {}
    const fxFramesJsx = []
    const { global } = json
    if (global) {
      const { fxFrames } = global
      if (Array.isArray(fxFrames)) {
        fxFrames.forEach((fxFrame) => {
          const { id } = fxFrame
          const fxInfo = {}
          fxFramesMap[id] = fxInfo
          const options = {
            ...opts,
            env: {
              ...opts.env,
              canvas: Object.assign({
                id,
                type: window?.document.body.clientWidth <= 414 ? 'mobile' : 'pc', // 服务端渲染没有window
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
                    Object.entries(scenesMap).forEach(([key, scenes]) => {
                      if (key === sceneId) {
                        if (openType === 'blank') {
                          scenes.useEntryAnimation = true
                        } else {
                          scenes.useEntryAnimation = false
                        }
                        scenes.show = true
                        if (scenes.type === 'popup') {
                          // setPopupIds((popupIds) => {
                          //   return [...popupIds, sceneId]
                          // })
                          this.setPopupIds([...this.popupIds, sceneId])
                        } else {
                          setCount((count) => count+1)
                        }
                      } else {
                        scenes.show = false
                        if (scenes.type === 'popup') {
                          // setPopupIds((popupIds) => {
                          //   return popupIds.filter((id) => id !== scenes.json.id)
                          // })
                          this.setPopupIds(this.popupIds.filter((id) => id !== scenes.json.id))
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
                        // setPopupIds((popupIds) => {
                        //   return [...popupIds, sceneId]
                        // })
                        this.setPopupIds([...this.popupIds, sceneId])
                      } else {
                        setCount((count) => count+1)
                      }
                    }
                  }
                }
              }, opts.env?.canvas),
            },
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
                          this._notifyBindings(scenes._refs, comId, bindingsTo[comId], val)
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
              },
              exeGlobalCom({ com, value, pinId }) {
                this.globalVarMap[com.id] = value
                Object.keys(scenesMap).forEach((key) => {
                  const scenes = scenesMap[key]
                  if (scenes.show && scenes._refs) {
                    const globalCom = scenes._refs.get(com.id)
                    if (globalCom) {
                      globalCom.outputs[pinId](value, true, null, true)
                    }
                  }
                })
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

          // fxFramesJsx.push(<Main key={id} json={{...fxFrame, rtType: 'js'}} opts={options}/>)

          fxFramesJsx.push({
            key: id,
            component: Main,
            json: {...fxFrame, rtType: 'js'},
            options
          })
        })
      }
    }

    this.fxFramesMap = fxFramesMap
    this.fxFramesJsx = fxFramesJsx
  },
  computed: {
    scenes() {
      const { pageScenes, scenesMap } = this

      if (!pageScenes.length) {
        return []
      }

      const { json } = this.$props; 
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

        return {
          show: scene.show,
          key: id,
          json: { ...json, scenesMap },
          opts: this.options(id),
          // className: scene.useEntryAnimation ? css.main : ''
          className: scene.useEntryAnimation ? $style.main : '',
          style: scene.type === 'popup' ? { position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00' } : {}
        }
      })
    },
    popups() {
      const { popupIds, scenesMap } = this

      if (!popupIds.length) {
        return []
      }

      const { json } = this.$props; 
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

        return {
          key: json.id,
          json: { ...json, scenesMap },
          opts: this.options(id),
          style: { position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00' }
        }
        // return <Scene key={json.id} json={{...json, scenesMap}} opts={options(id)} style={{position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00'}}/>
      })
    }
  },
  methods: {
    setCount(count) {
      this.count = count;
    },
    setPopupIds(popupIds) {
      this.popupIds = popupIds;
    },
    setPageScenes(pageScenes) {
      this.pageScenes = pageScenes;
    },
    options(id) {
      const { opts } = this.$props
      const { scenesMap, themes, permissions } = this

      const that = this

      const scenes = scenesMap[id]
      const hasPermission = opts.env.hasPermission

      return {
        ...opts,
        env: {
          ...opts.env,
          themes,
          permissions,
          hasPermission: typeof hasPermission === 'function' ? (value) => {
            // TODO 兼容老的组件用法
            if (typeof value === 'string') {
              const permission = permissions.find((permission) => permission.id === value)
              return hasPermission({ permission })
            }
            return hasPermission(value)
          } : null,  
          canvas: Object.assign({
            id,
            type: window?.document.body.clientWidth <= 414 ? 'mobile' : 'pc',
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
                Object.entries(scenesMap).forEach(([key, scenes]) => {
                  if (key === sceneId) {
                    if (openType === 'blank') {
                      scenes.useEntryAnimation = true
                    } else {
                      scenes.useEntryAnimation = false
                    }
                    scenes.show = true
                    if (scenes.type === 'popup') {
                      // setPopupIds((popupIds) => {
                      //   return [...popupIds, sceneId]
                      // })
                      that.setPopupIds([...that.popupIds, sceneId])
                    } else {
                      setCount((count) => count+1)
                    }
                  } else {
                    scenes.show = false
                    if (scenes.type === 'popup') {
                      // setPopupIds((popupIds) => {
                      //   return popupIds.filter((id) => id !== scenes.json.id)
                      // })
                      that.setPopupIds(that.popupIds.filter((id) => id !== scenes.json.id))
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
                    // setPopupIds((popupIds) => {
                    //   return [...popupIds, sceneId]
                    // })
                    that.setPopupIds([...that.popupIds, sceneId])
                  } else {
                    setCount((count) => count+1)
                  }
                }
              }
            }
          }, opts.env?.canvas),
        },
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
              scenes.show = false
              scenes.todo = []
              scenes._refs = null
              scenes.parentScope?.outputs[output.id](value)
              scenes.parentScope = null
              if (scenes.type === 'popup') {
                // setPopupIds((popupIds) => {
                //   return popupIds.filter((id) => id !== scenes.json.id)
                // })
                that.setPopupIds(that.popupIds.filter((id) => id !== scenes.json.id))
              } else {
                setCount((count) => count+1)
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
                that._notifyBindings(_refs, comId, bindings, value)
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

          Object.entries(that.globalVarMap).forEach(([ key, value ]) => {
            const globalCom = scenes._refs.get(key)
            if (globalCom) {
              globalCom.outputs['changed'](value, true, null, true)
            }
          })
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
                // setPopupIds((popupIds) => {
                //   return popupIds.filter((id) => id !== scenes.json.id)
                // })
                console.log(that, 'that')
                that.setPopupIds(that.popupIds.filter((id) => id !== scenes.json.id))
              } else {
                setCount((count) => count+1)
              }
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
      
                if (scenes.type === 'popup') {
                  // setPopupIds((popupIds) => {
                  //   return [...popupIds, frameId]
                  // })
                  that.setPopupIds([...that.popupIds, frameId])
                } else {
                  setCount((count) => count+1)
                }
              }
            } else {
              const fxFrame = fxFramesMap[frameId]
              if (fxFrame?._refs) {
                fxFrame.parentScope = parentScope
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
                      this._notifyBindings(scenes._refs, comId, bindingsTo[comId], val)
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
          },
          exeGlobalCom({ com, value, pinId }) {
            that.globalVarMap[com.id] = value
            Object.keys(scenesMap).forEach((key) => {
              const scenes = scenesMap[key]
              if (scenes.show && scenes._refs) {
                const globalCom = scenes._refs.get(com.id)
                if (globalCom) {
                  globalCom.outputs[pinId](value, true, null, true)
                }
              }
            })
          }
        }
      }
    },
    _notifyBindings(_refs, comId, bindings, value) {
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
  }
}

</script>

<style module>
@keyframes slipInto {
  0% {
    transform: translateX(100%);
    opacity: 0
  }

  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

.main {
  animation: slipInto 0.1s ease-in-out 1;
}
</style>
