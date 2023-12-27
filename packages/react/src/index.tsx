/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, { useContext, createContext } from "react";

import Main from "./Main";
import pkg from "../package.json";
import MultiScene from "./MultiScene";
import Debugger from "./plugins/Debugger";
import { hijackReactcreateElement } from "./observable"
import RenderSlotLess from './RenderSlot.lazy.less';
import MultiSceneLess from './MultiScene.lazy.less';
import ErrorBoundaryLess from './ErrorBoundary/style.lazy.less';
import NotificationLess from './Notification/style.lazy.less';
import DebuggerLess from './Debugger/style.lazy.less';
import { setLoggerSilent } from '../../core/logger';
import Notification from './Notification';
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
  _isNestedRender: boolean;
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
  // 传入的配置项
  constructor(public options: RenderOptions) {
    const { env, debug, observable, onError, plugins = [] } = options
    this.mode = debug ? 'development' : 'production'
    if (!observable) {
      /** 未传入observable，使用内置observable配合对React.createElement的劫持 */
      hijackReactcreateElement({pxToRem: env.pxToRem, pxToVw: env.pxToVw});
    }
    // 样式加载dom节点
    const LOAD_CSS_LAZY_ROOT = getStylesheetMountNode()
    // 执行安装的插件
    // 暂时内置前面的插件
    const arr = [new Debugger()]
    arr.concat(plugins).forEach((plugin) => {
      plugin.apply(this)
    })
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

    /** 一些默认值 */
    // 运行时，默认为runtime模式
    if (!env.runtime) {
      env.runtime = {}
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
  // useEffect(() => {
  //   return () => {
  //     console.log("render 渲染根组件 销毁: ", value) // 这里可以做各类销毁动作，尤其是一些插件
  //   }
  // }, [])
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

export function render(json: ToJSON | MultiSceneToJSON, options: RenderOptions) {
  if (!json) {
    return null
  } else {
    let jsx = null
    if ("scenes" in json)  {
      transformJSON(json);
      jsx = <MultiScene json={json} opts={options}/>
    } else {
      // 检查一下这个json.type的判断能否去掉
      jsx = <Main json={json} opts={options} root={json.type === 'module' ? false : true}/>
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
    const { comsReg, consReg, pinRels, fxFrames } = global
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
      })
    }
    scenes.forEach((scene: any) => {
      if (comsReg) {
        Object.assign(scene.coms, comsReg)
      }
      if (consReg) {
        Object.assign(scene.cons, consReg)
      }
      if (pinRels) {
        Object.assign(scene.pinRels, pinRels)
      }
    })
  }
}

export * from "./observable"
