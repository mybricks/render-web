/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, { useEffect, useContext, createContext } from "react";

import Main from "./Main";
import pkg from "../package.json";
import MultiScene from "./MultiScene";
import Debugger from "./plugins/Debugger";
import { hijackReactcreateElement, observable as defaultObservable } from "./observable"
import RenderSlotLess from './RenderSlot.lazy.less';
import MultiSceneLess from './MultiScene.lazy.less';
import ErrorBoundaryLess from './ErrorBoundary/style.lazy.less';
import NotificationLess from './Notification/style.lazy.less';
import { setLoggerSilent } from '../../core/logger';
import Notification from './Notification';
import executor from '../../core/executor'
import { compareVersion, getStylesheetMountNode } from '../../core/utils';
import type { ToJSON, MultiSceneToJSON } from "./types";
// @ts-ignore
import coreLib from '@mybricks/comlib-core';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

function loadCSSLazy (css: typeof RenderSlotLess, root: Node) {
  css.use({ target: root });
}

interface RenderOptions {
  env: any;
  // TODO: 改造完成后在透出的类型里隐藏
  _isNestedRender?: boolean;
  [key: string]: any;
}

class Context {
  // TODO: 性能面板，作为插件注入，加一个开关（例如localStorage
  private performance: any = {
    render: {
      // @ts-ignore
      // 开始
      start: window.MYBRICKS_PC_FMP_START || new Date().getTime(),
      // 结束
      end: null,
      // 耗时
      time: null
    },
    // 连接器数据收集（耗时，配置信息）
    callConnectorTimes: []
  }

  onCompleteCallBacks: Array<() => void> = []

  /**
   * - development - 引擎环境
   * - production - 生产环境
   */
  mode: 'development' | 'production'
  
  // 组件信息 namespace-version => {runtime}
  comDefs: {
    [key: string]: {
      namespace: string;
      version: string;
      runtime: React.FC<any>
    }
  } = {}
  // 组件runtime入参
  onError: (error: Error | string) => void = (e) => {
    console.error(e);
    Notification.error(e);
  }
  // onError: (params: Error | string) => null
  // 组件runtime入参
  logger: any

  // 将对象转换为响应式对象的方法
  observable = defaultObservable

  // 传入的配置项
  constructor(public options: RenderOptions) {
    const { env, debug, observable, onError, plugins = [] } = options
    this.mode = debug ? 'development' : 'production'
    if (!observable) {
      /** 未传入observable，使用内置observable配合对React.createElement的劫持 */
      hijackReactcreateElement({pxToRem: env.pxToRem, pxToVw: env.pxToVw});
    } else {
      this.observable = observable
    }
    // 样式加载dom节点
    const LOAD_CSS_LAZY_ROOT = getStylesheetMountNode()
    // 各种lazycss加载
    loadCSSLazy(RenderSlotLess, LOAD_CSS_LAZY_ROOT)
    loadCSSLazy(MultiSceneLess, LOAD_CSS_LAZY_ROOT)
    loadCSSLazy(ErrorBoundaryLess, LOAD_CSS_LAZY_ROOT)
    loadCSSLazy(NotificationLess, LOAD_CSS_LAZY_ROOT);

    // px转rem响应式相关
    const pxToRem = env?.pxToRem
    if (pxToRem) {
      const {
        // 是否开启自适应
        enableAdaptive = false,
        // 基准宽度，例如在引擎搭建时基于1440px的画布搭建
        landscapeWidth = 1440
      } = pxToRem
      const rootDom = document.documentElement
      if (enableAdaptive) {
        const calculateFontSize = () => {
          rootDom.style.fontSize = (rootDom.clientWidth / (landscapeWidth / 12)) + 'px'
        }
        calculateFontSize()
        // 监听页面resize，修改font-size
        window.addEventListener('resize', calculateFontSize)
      } else {
        // 默认12px，与引擎同步
        rootDom.style.fontSize = '12px';
      }
    }

    const { onCompleteCallBacks } = this
    /** 一些默认值 */
    // 运行时，默认为runtime模式
    if (!env.runtime) {
      env.runtime = {
        // debug: {
        //   onComplete(fn: any) {
        //     onCompleteCallBacks.push(fn)
        //   }
        // },
        onComplete(fn: any) {
          onCompleteCallBacks.push(fn)
        }
      }
    }
    // 国际化，是否可以去除？？，PC通用组件库内使用
    // TODO: 去除
    if (!env.i18n) {
      env.i18n = (text: unknown) => text
    }
    // 渲染模块，提供的默认能力，引擎环境内引擎提供
    if (!env.renderModule) {
      // 模块组件内调用
      env.renderModule = (json: any, options: any) => {
        // 最终还是调render-wen提供的render函数，渲染toJSON
        return render(json, { ...options, env, _isNestedRender: true })
      }
    } else {
      const renderModule = env.renderModule
      env.renderModule = (json: any, options: any) => {
        // 最终还是调render-wen提供的render函数，渲染toJSON
        return renderModule(json, { ...options, env, _isNestedRender: true })
      }
    }
    if (!env.renderCom) {
      env.renderCom = (json: any, options: any) => {
        // 最终还是调render-wen提供的render函数，渲染toJSON
        return render(json, { ...options, _isNestedRender: true })
      }
    } else {
      const renderCom = env.renderCom
      env.renderCom = (json: any, options: any) => {
        // 最终还是调render-wen提供的render函数，渲染toJSON
        return renderCom(json, { ...options, _isNestedRender: true })
      }
    }
    const body = document.body
    // 用于判断是mobile或pc，组件响应式，目前通用pc组件库内有使用
    if (!env.canvas) {
      // 引擎环境内引擎提供，非引擎环境默认body的clientWidth与414对比
      env.canvas = {
        get type() {
          return body.clientWidth <= 414 ? 'mobile' : 'pc'
        }
      }
    }
    // 用于调试时弹窗类挂载
    if (!('canvasElement' in env)) {
      // 引擎环境内引擎提供，非引擎环境默认body
      env.canvasElement = body
    }

    /** 函数劫持 */
    // render-web知道一定存在env.callConnector，用于“服务接口”组件
    const callConnector = env.callConnector
    // TODO: 性能面板，作为插件注入
    if (typeof callConnector === 'function') {
      // 劫持callConnector获取执行时间和执行信息，写入性能面板
      env.callConnector = (connector: any, params: any, connectorConfig: any) => {
        const start = new Date().getTime()
        let end: any = null
        const connectorTime: any = {
          basicInformation: {
            connector, params, connectorConfig
          },
          start,
          type: 'success'
        }
        return new Promise((resolve, reject) => {
          callConnector(connector, params, connectorConfig).then((res: any) => {
            end = new Date().getTime()
            resolve(res)
          }).catch((err: any) => {
            end = new Date().getTime()
            connectorTime.type = 'error'
            reject(err)
          }).finally(() => {
            connectorTime.end = end
            connectorTime.time = end - start
            this.setPerformanceCallConnectorTimes(connectorTime)
          })
        })
      }
    }
    const that = this
    // @ts-ignore
    // TODO: 性能面板，作为插件注入
    window["RENDER_WEB_PERFORMANCE"] = {
      getPerformance: this.getPerformance.bind(that)
    }

    // 初始化其它信息
    this.initOther()
    // 收集页面组件信息
    this.initComdefs()

    // 执行安装的插件
    // 暂时内置前面的插件
    const arr = [new Debugger()]
    arr.concat(plugins).forEach((plugin) => {
      plugin.apply(this)
    })
  }

  // 初始化其它信息
  initOther() {
    const { env } = this.options
    // 是否打印IO输入输出的数据信息
    // TODO: 通过options传入，而非env
    if (!!env.silent) {
      // 调试模式下有debugger，所以无论silent设置，都没有影响
      setLoggerSilent();
    }
    // 是否显示错误通知
    // TODO: 通过options传入，而非env
    Notification.init(env.showErrorNotification);

    // 这里看看怎么做成插件的形式
    this.logger = {
      info: console.info,
      trace: console.trace,
      warn: console.warn,
      error: (e: any) => {
        console.error(e);
        Notification.error(e);
      }
    }
  }

  // 初始化组件信息
  initComdefs() {
    const regAry = (comAray: any, comDefs: any) => {
      comAray.forEach((comDef: any) => {
        if (comDef.comAray) {
          regAry(comDef.comAray, comDefs);
        } else {
          comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
        }
      })
    }
    const { comDefs: defaultComdefs } = this.options;
    const { comDefs } = this;

    /** 外部传入组件信息 */
    if (defaultComdefs) {
      Object.assign(comDefs, defaultComdefs);
    }

    /** 默认从window上查找组件库，是否考虑如果传入了comDefs就不去window上再找一遍了 */
    let comLibs = [...((window as any)["__comlibs_edit_"] || []), ...((window as any)["__comlibs_rt_"] || [])];

    /** 插入核心组件库(fn,var等) */
    comLibs.push(coreLib)
    comLibs.forEach(lib => {
      const comAray = lib.comAray;
      if (comAray && Array.isArray(comAray)) {
        regAry(comAray, comDefs);
      }
    })
  }

  /** 
   * 通过namespace-version查找组件
   * 
   * TODO: 优化查询方式，目前每个找不到的组件都重复全量查，找不到的组件在第一次使用最新版本后做好记录，后面不会重复查找
   */
  getComDef(def: { namespace: string, version: string }) {
    const { comDefs } = this
    const rtn = comDefs[def.namespace + '-' + def.version]
    if (!rtn) {
      const ary = []
      for (let ns in comDefs) {
        if (ns.startsWith(def.namespace + '-')) {
          ary.push(comDefs[ns])
        }
      }

      if (ary && ary.length > 0) {
        ary.sort((a, b) => {
          return compareVersion(a.version, b.version)
        })

        const rtn0 = ary[0]
        console.warn(`【Mybricks】组件${def.namespace + '@' + def.version}未找到，使用${rtn0.namespace}@${rtn0.version}代替.`)

        return rtn0
      } else {
        console.error(`组件${def.namespace + '@' + def.version}未找到，请确定是否存在该组件以及对应的版本号.`)
        return null
      }
    }
    return rtn
  }

  // 模块相关，目前仅用于全局变量发生变化后，对全局变量的监听，目前没有变量的监听了，先注释掉，在使用模块的场景可以优化部分性能
  // private _refsMap: any = {}
  // setRefs(id: string, refs: any) {
  //   this._refsMap[id] = refs
  // }
  // getRefsMap() {
  //   return this._refsMap
  // }

  // TODO: 性能面板，作为插件注入
  getPerformance() {
    return this.performance
  }
  setPerformanceRender(type: "start" | "end", time: number) {
    const render = this.performance.render
    render[type] = time
    if (type === "end") {
      render["time"] = time - render["start"]
    }
  }
  setPerformanceCallConnectorTimes(connectorTime: any) {
    this.performance.callConnectorTimes.push(connectorTime)
  }
}

const MyBricksRenderContext = createContext<any>({})

export function MyBricksRenderProvider ({ children, value }: any) {
  useEffect(() => {
    return () => {
      value.onCompleteCallBacks.forEach((cb: any) => {
        cb()
      })
    }
  }, [])
  return (
    <MyBricksRenderContext.Provider value={value}>
      {children}
    </MyBricksRenderContext.Provider>
  )
}

export function useMyBricksRenderContext () {
  const context = useContext(MyBricksRenderContext)

  return context
}

import { transformToJSON } from "../../utils/src"

export function render(json: ToJSON | MultiSceneToJSON, options: RenderOptions) {
  if (!json) {
    return null
  } else {
    let jsx = null
    if ("scenes" in json) {
      transformToJSON(json);
      jsx = <MultiScene json={json} options={options}/>
    } else {
      if (json.slot) {
        // 检查一下这个json.type的判断能否去掉
        jsx = <Main json={json} options={options} root={json.type === 'module' ? false : true}/>
      }
    }
    if (!jsx) {
      // TODO: 这里是运行纯函数的模版
      const _context = new Context(options)
      executor({
        json,
        getComDef: (def: any) => _context.getComDef(def),
        events: options.events,
        env: options.env,
        ref(_refs: any) {
          const { inputs } = _refs
          const jsonInputs = (json as ToJSON).inputs
          if (inputs && Array.isArray(jsonInputs)) {
            jsonInputs.forEach((input) => {
              const { id, mockData } = input
              let value = void 0
              if (options.debug && typeof mockData !== 'undefined') {
                try {
                  value = JSON.parse(decodeURIComponent(mockData))
                } catch {
                  value = mockData
                }
              }
              inputs[id](value)
            })
          }
          _refs.run()
        },
        onError: _context.onError,
        debug: options.debug,
        debugLogger: options.debugLogger,
        logger: _context.logger,
        scenesOperate: options.scenesOperate,
        _context
      }, {
        observable: _context.observable
      }) 
      return null
    }
    // 如果是嵌套渲染，不再重复嵌套Provider
    if (options._isNestedRender) {
      return jsx
    }
    return (
      <MyBricksRenderProvider value={new Context(options)}>
        {jsx}
      </MyBricksRenderProvider>
    )
  }
}

/** 
 * 提前处理全局变量、全局FX相关数据，渲染时不再需要关心，
 * 这段逻辑有没有可能再生成tojson的时候调一下，渲染时能够更轻
 * 向外暴露 transformJSON 函数？
 */
function transformJSON (json: MultiSceneToJSON) {
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

export * from "./observable"

function traverseElements(elements: any) {
  return calculateRow(elements)
}

function calculateRow(elements: any) {
  const rows: any = []
  let rowIndex = 0
  let height = 0
  let top = 0
  let finish = false

  /**
   * 分析行
   * - 高度 height
   * - 上外边距 top
   */
  elements.forEach((element: any) => {
    if (!rows[rowIndex]) {
      // 新的一行，直接赋值
      rows[rowIndex] = [element]
      height = element.height
      top = element.top
      finish = true
    } else {
      const elementHeight = element.height
      const elementTop = element.top

      if (elementTop >= height) {
        // top比height大，换行
        if (rows[rowIndex].length > 1) {
          rows[rowIndex] = calculateColumn(rows[rowIndex])
        }
        rowIndex = rowIndex + 1
        rows[rowIndex] = [element]
        height = elementHeight + elementTop
        top = elementTop
        finish = true
      } else {
        rows[rowIndex].push(element)
        finish = false
      }
    }
  })

  if (!finish) {
    rows[rowIndex] = calculateColumn(rows[rowIndex])
  }

  return rows.map((row: any) => {
    return {
      type: 'row',
      items: row
    }
  })
}

function calculateColumn(elements: any) {
  console.log("处理列: ", elements)
  // const indexAry: any = []
  const columns: any = []
  let columnIndex = 0
  let width = 0
  let left = 0
  let finish = false

  /**
   * 分析列
   * - 宽度 width
   * - 左外边距 left
   */
  elements.forEach((element: any, index: any) => {
    if (!columns[columnIndex]) {
      // 新的一列，直接赋值
      columns[columnIndex] = [element]
      // indexAry[index] = columns[columnIndex][0]
      width = element.width
      left = element.left
      finish = true
    } else {
      const elementWidth = element.width
      const elementLeft = element.left

      if (elementLeft >= width) {
        // left比width大，换列
        if (columns[columnIndex].length > 1) {
          columns[columnIndex] = calculateRow(columns[columnIndex])
        }
        columnIndex = columnIndex + 1
        columns[columnIndex] = [element]
        // indexAry[index] = columns[columnIndex][0]
        width = elementWidth + elementLeft
        left = elementLeft
        finish = true
      } else {
        // let count = indexAry.length - 1
        let count = index - 1


        while (count > -1) {
          // const lastElement = indexAry[count]
          const lastElement = elements[count]
          if (checkElementRelationship(lastElement, element)) {
            // TODO: 包含，还缺一个相交
            count = -2
            lastElement.children.push({
              ...element,
              top: element.top - lastElement.top,
              left: element.left - lastElement.left
            })
          } else {
            count = count - 1
          }
        }

        if (count != -2) {
          columns[columnIndex].push(element)
          finish = false
        }
      }
    }
  })

  if (!finish) {
    columns[columnIndex] = calculateRow(columns[columnIndex])
  }

  return columns.map((column: any) => {
    return {
      type: 'column',
      items: column
    }
  })
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
    a_height + a_top >= b_height + b_top
  ) {
    return true
  }

  return false
}
