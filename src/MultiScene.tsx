import React, {
  useMemo,
  useState,
  useCallback
} from 'react'

import Main from './Main'

export default function MultiScene ({json, opts}) {
  const [count, setCount] = useState(0)

  const [{scenesMap}] = useState({
    scenesMap: json.scenes.reduce((acc, json, index) => {
      return {
        ...acc,
        [json.id]: {
          show: index === 0,
          todo: [],
          json
        }
      }
    }, {}),
  })

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

  const options = useCallback((id) => {
    const scenes = scenesMap[id]

    return {
      ...opts,
      ref: opts.ref((_refs) => {
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

        todo.forEach(({type, todo}) => {
          if (type === 'inputs') {
            Promise.resolve().then(() => {
              inputs[todo.pinId](todo.value)
            })
          } else if (type === 'globalVar') {
            const { comId, value, bindings } = todo
            _notifyBindings(_refs, comId, bindings, value)
          }
        })

        scenes.todo = []
      }),
      _env: {
        loadCSSLazy() {},
        currentScenes: {
          close() {
            scenes.show = false
            scenes.todo = []
            scenes._refs = null
            scenes.parentScope = null
            setCount((count) => count+1)
          }
        }
      },
      scenesOperate: {
        open({todo, frameId, parentScope}) {
          const scenes = scenesMap[frameId]

          if (!scenes.show) {
            scenes.show = true
            scenes.todo = scenes.todo.concat({type: 'inputs', todo})
            scenes.parentScope = parentScope
  
            setCount((count) => count+1)
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
      
      return scenesMap[id].show && <Scene key={json.id} json={{...json, scenesMap}} opts={options(id)} style={!index ? {} : {position: 'absolute', top: 0, left: 0}}/>
    })
  }, [count])

  return scenes
}

function Scene({json, opts, style = {}}) {
  return (
    <Main json={json} opts={opts} style={style}/>
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
