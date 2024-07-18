import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react'

import Main from './Main'
import { useMyBricksRenderContext } from '.'
import executor from '../../core/executor'

import lazyCss from './MultiScene.lazy.less'

class DebugHistory {
  history: {
    id: string;
    todo: any[]
  }[] = [];
  index = -1;

  constructor(scene: any) {
    if (scene.type !== "popup") {
      this.history[++this.index] = {
        id: scene.id,
        todo: []
      };
    }
  }

  go(id: string) {
    // 打开
    this.history = this.history.slice(0, ++this.index).concat({
      id,
      todo: []
    });
  }

  back() {
    // 回退
    if (this.index > 0) {
      return this.history[--this.index];
    }
  }

  forward() {
    // 前进
    if (this.history.length > this.index + 1) {
      return this.history[++this.index];
    }
  }

  redirect(id: string) {
    // 重定向
    if (this.index > -1) {
      this.history = this.history.slice(0, this.index).concat({
        id,
        todo: []
      });
    }
  }

  setTodo(todo: any) {
    this.history[this.index].todo = todo
  }

}

const css = lazyCss.locals

export default function MultiScene ({json, options}) {
  const _context = useMyBricksRenderContext()
  const [count, setCount] = useState(0)
  const [popupIds, setPopupIds] = useState<any>([])
  const [pageScenes, setPageScenes] = useState<any>([])

  const {scenesMap, scenesOperateInputsTodo, globalVarMap, debugHistory, env} = useMemo(() => {
    const { sceneId, env, disableAutoRun } = options;
    if (sceneId) {
      const index = json.scenes.findIndex((scenes) => scenes.id === sceneId)
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

    const { modules, definedComs, global } = json

    if (!env.getDefinedComJSON) {
      env.getDefinedComJSON = (definedId: string) => {
        return definedComs[definedId].json
      }
    }
    env.getModuleJSON = (moduleId: string) => {
      return modules?.[moduleId]?.json
    }
    const permissions = json.permissions || []
    env.themes = json.themes
    env.permissions = permissions
    const hasPermission = env.hasPermission;
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

    /** 便于通过id查找全局FX信息 */
    const globalFxIdToFrame = {};
    global.fxFrames.forEach((fx) => {
      globalFxIdToFrame[fx.id] = fx;
    });

    env.canvas.open = async (sceneId, params, openType, historyType) => {
      // console.log(`打开场景 -> ${sceneId}`)
      let scenes = scenesMap[sceneId]

      if (!scenes) {
        if (typeof options.scenesLoader !== 'function') {
          if (env.history) {
            env.history.go(sceneId);
          } else {
            console.error(`缺少场景信息: ${sceneId}`)
          }
          return
        }
        const json = await options.scenesLoader({id: sceneId})

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

      options.scenesLoaded?.(scenes.json)

      if (openType) {
        if (openType === "popup") { // 兼容小程序场景的标签页打开
          scenes.disableAutoRun = false
        }
        if (openType === "none") {
          scenesMap[sceneId].show = true;
          setCount((count) => count+1)
        } else {
          if (!historyType) {
            // 没有历史类型，需要记录打开和重定向
            if (openType === "blank") {
              debugHistory.go(sceneId)
            } else if (openType === "redirect") {
              debugHistory.redirect(sceneId)
            }
          }
          Object.entries(scenesMap).forEach(([key, scenes]: any) => {
            if (key === sceneId) {
              if (openType === 'blank' && options.sceneOpenType !== 'redirect') {
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
              scenes._refs = null
              if (scenes.type === 'popup') {
                setPopupIds((popupIds) => {
                  return popupIds.filter((id) => id !== scenes.json.id)
                })
              } else {
                setCount((count) => count+1)
              }
            }
          })
        }
      } else {
        if (!scenes.show) {
          if (openType === 'blank' && options.sceneOpenType !== 'redirect') {
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

    // 回退
    env.canvas.back = () => {
      const back = debugHistory.back();
      if (back) {
        const { id, todo } = back;
        env.canvas.open(id, null, "blank", "back")
        const scenes = scenesMap[id]
        scenes.todo = todo
      }
    }

    // 前进
    env.canvas.forward = () => {
      const forward = debugHistory.forward();
      if (forward) {
        const { id, todo } = forward;
        env.canvas.open(id, null, "blank", "forward")
        const scenes = scenesMap[id]
        scenes.todo = todo
      }
    }

    // TODO:挪出去，优化一下
    const scenesOperate = {
      open({todo, frameId, parentScope, comProps}) {
        // 目前这里仅用于调用全局fx
        const fxFrame = globalFxIdToFrame[frameId];

        if (fxFrame) {
          executor({
            json: fxFrame,
            getComDef: (def) => _context.getComDef(def),
            events: options.events,
            env,
            ref(refs) {
              const { inputs, outputs } = refs;

              // 注册fx输出
              fxFrame.outputs.forEach((output) => {
                outputs(output.id, (value) => {
                  // 输出对应到fx组件的输出
                  parentScope.outputs[output.id](value);
                });
              });

              /** 配置项 */
              const configs = comProps?.data?.configs;
              if (configs) {
                // 先触发配置项
                Object.entries(configs).forEach(([key, value]) => {
                  inputs[key](value, void 0, false);
                });
              }
              // 调用inputs
              inputs[todo.pinId](todo.value, void 0, false);
              // 执行自执行组件
              refs.run();
            },
            onError: _context.onError,
            debug: options.debug,
            debugLogger: options.debugLogger,
            logger: _context.logger,
            scenesOperate,
            _context
          }, {//////TODO goon
            observable: _context.observable//传递获取响应式的方法
          })
        } else {
          env.callServiceFx?.(frameId, todo.value).then(({ id, value }: any) => {
            parentScope.outputs[id](value);
          })
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
        return scenesMap[json.scenes[0].id]._refs?.get({comId}) || {
          data: {
            val: globalVarMap[comId]
          }
        }
      },
      exeGlobalCom({ com, value, pinId }) {
        const globalComId = com.id
        globalVarMap[globalComId] = value
        Object.keys(scenesMap).forEach((key) => {
          const scenes = scenesMap[key]
          if (scenes.show && scenes._refs) {
            const globalCom = scenes._refs.get({comId: globalComId})
            if (globalCom) {
              globalCom.outputs[pinId](value, true, null, true)
            }
          }
        })
        // const refsMap = _context.getRefsMap()
        // Object.entries(refsMap).forEach(([id, refs]: any) => {
        //   const globalCom = refs.get({comId: globalComId})
        //     if (globalCom) {
        //       globalCom.outputs[pinId](value, true, null, true)
        //     }
        // })
      }
    }

    env.scenesOperate = scenesOperate

    return {
      scenesMap: json.scenes.reduce((acc, json, index) => {
        return {
          ...acc,
          [json.id]: {
            show: index === 0,
            todo: [],
            json,
            disableAutoRun: !!(disableAutoRun || index),
            useEntryAnimation: false,
            type: json.slot?.showType || json.type,
            main: index === 0
          }
        }
      }, {}),
      scenesOperateInputsTodo: {},
      globalVarMap: {},
      debugHistory: new DebugHistory(json.scenes[0]),
      globalFxIdToFrame,
      env
    }
  }, [])

  useMemo(() => {
    if (options.ref) {
      const ref = options.ref
      options.ref = (cb) => (_refs) => {
        cb(_refs)
        return ref.call(options, _refs)
      }
    } else {
      options.ref = (cb) => (_refs) => {
        cb(_refs)
      }
    }
  }, [])

  const getOptions = useCallback((id) => {
    const scenes = scenesMap[id]
    return {
      ...options,
      env,
      get disableAutoRun() {
        return scenes.disableAutoRun
      },
      ref: options.ref((_refs) => {
        // console.log(`场景注册_refs -> ${id}`)
        /** 整站搭建需求 */
        _refs.canvas = env.canvas
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
              if (scenes.type !== 'module' && disableAutoRun) {
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
              } else {
                scenes.parentScope?.outputs[output.id](value)
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
          if (!scenes.type) {
            // 页面记录历史todo
            debugHistory.setTodo(todo);
          }
  
          scenes.todo = []
        } else if (!disableAutoRun) {
          scenes.disableAutoRun = true
          Promise.resolve().then(() => {
            const todo = []
            scenes.json.inputs?.forEach?.((input) => {
              const { id, mockData } = input
              let value = void 0
              if (options.debug && typeof mockData !== 'undefined') {
                try {
                  value = JSON.parse(decodeURIComponent(mockData))
                } catch {
                  value = mockData
                }
              }
              // 记录历史todo
              todo.push({
                type: "inputs",
                todo: {
                  pinId: id,
                  value
                }
              })
              inputs[id](value)
            })
            if (!scenes.type) {
              // 页面记录历史todo
              debugHistory.setTodo(todo);
            }
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
      scenesOperate: env.scenesOperate
    }
  }, [])

  const scenes = useMemo(() => {
    if (!pageScenes.length) {
      return null
    }
    return pageScenes.map((json) => {
      const { id } = json
      const scene = scenesMap[id]

      if (scene.show) {
        let className = scene.useEntryAnimation ? css.main : ''
        let style = scene.type === 'popup' ? {position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00'} : {}
        if (scene.main) {
          // 主场景
          const { className: optsClassName, style: optsStyle  } = options
          if (optsClassName) {
            className = className + ` ${optsClassName}`;
          }
          if (optsStyle) {
            style = Object.assign(style, optsStyle)
          }
        }
        
        return scene.show && (
          <Scene
            key={id}
            json={{...json, scenesMap}}
            options={getOptions(id)}
            className={className}
            style={style}
          />
        )
      }

      return null
    })
  }, [count, pageScenes])

  const popups = useMemo(() => {
    if (popupIds.length) {
      return popupIds.map((sceneId) => {
        const scene = scenesMap[sceneId]
        const json = scene.json
        const { id } = json

        let className = ''
        let style = {position: options.debug ? 'fixed' : 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00', zIndex: 1000}

        if (scene.main) {
          // 主场景
          const { className: optsClassName, style: optsStyle  } = options
          if (optsClassName) {
            className = optsClassName
          }
          if (optsStyle) {
            style = Object.assign(style, optsStyle)
          }
        }
        
        return (
          <Scene
            key={json.id}
            json={{...json, scenesMap}}
            options={getOptions(id)}
            style={{position: options.debug ? 'fixed' : 'absolute', top: 0, left: 0, backgroundColor: '#ffffff00', zIndex: 1000}}
          />
        )
      })
    }
   
    return null
  }, [popupIds])

  useEffect(() => {
    _context.setPerformanceRender("end", new Date().getTime())
  }, [])

  return (
    <>
      {scenes}
      {popups}
    </>
  )
}

function Scene({json, options, style = {}, className = ''}) {
  return (
    <Main json={json} options={options} style={style} className={className} from={"scene"}/>
  )
}

function _notifyBindings(_refs, comId, bindings, value) {
  const com = _refs.get({comId})
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
