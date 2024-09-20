// import { h, reactive, provide } from 'vue';
const { h, reactive, provide } = window.Vue

// @ts-ignore 包未提供类型声明文件
import coreLib from '@mybricks/comlib-core/fn'

import executor from '../../../core/executor'
import { compareVersion, deepCopy, getStylesheetMountNode, getPxToVw, convertCamelToHyphen, pxToRem } from "../../../core/utils";

import MIndex from './MIndex.vue';

import MMain from './MMain.vue';
import MMultiScene from './MMultiScene.vue';

import { MyBricksRenderContext, ModuleContext } from "./context";

export class Context {
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
  
  /** 
   * toJSON版本 
   * 2024-diff - toJSON api 传入 onlyDiff: true 得到，说明是压缩版的toJSON，需要处理组件的data、inputs、outputs
   */
  _v: string;
  
  // 组件信息 namespace-version => {runtime}
  comDefs: any = {}
  // 组件runtime入参
  onError: (error: Error | string) => void = (e) => {
    console.error(e);
    // Notification.error(e);
  }
  // onError: (params: Error | string) => null
  // 组件runtime入参
  logger: any

  // 将对象转换为响应式对象的方法
  observable = reactive

  // 传入的配置项
  constructor(public options: any, json: any) {
    this._v = json._v
    const { env, debug, observable, onError, plugins = [], rootId } = options
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
          if (debug) {
            onCompleteCallBacks.push(fn)
          }
        }
      }
    }
    // 样式加载dom节点
    const LOAD_CSS_LAZY_ROOT = document.head;
    options.stylization = new Stylization({
      rootId,
      root: LOAD_CSS_LAZY_ROOT,
      options,
      onCompleteCallBacks
    });
    this.mode = debug ? 'development' : 'production'

    let handlePxToVw;
    // px转vw响应式相关
    const pxToVw = options?.pxToVw
    if (pxToVw) {
      handlePxToVw = getPxToVw(pxToVw)
      options.handlePxToVw = handlePxToVw
      env.pxToVw = handlePxToVw
    } else {
      env.pxToVw = (v: any) => v;
    }

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

    // if (!observable) {
    //   /** 未传入observable，使用内置observable配合对React.createElement的劫持 */
    //   hijackReactcreateElement({pxToRem: env.pxToRem, pxToVw: handlePxToVw});
    // } else {
    //   this.observable = observable
    // }
    // 各种lazycss加载
    // loadCSSLazy(RenderSlotLess, LOAD_CSS_LAZY_ROOT)
    // loadCSSLazy(MultiSceneLess, LOAD_CSS_LAZY_ROOT)
    // loadCSSLazy(ErrorBoundaryLess, LOAD_CSS_LAZY_ROOT)
    // loadCSSLazy(NotificationLess, LOAD_CSS_LAZY_ROOT);

    // 国际化，是否可以去除？？，PC通用组件库内使用
    // TODO: 去除
    if (!env.i18n) {
      env.i18n = (text: unknown) => text
    }
    // 渲染模块，提供的默认能力，引擎环境内引擎提供
    // if (!env.renderModule) {
    //   // 模块组件内调用
    //   env.renderModule = (json: any, options2: any) => {
    //     const rootId1 = options.rootId
    //     const rootId2 = options2.rootId
    //     let rootId = rootId1 || rootId2;
    //     if (rootId1 && rootId2) {
    //       rootId = rootId1 + '_' + rootId2
    //     }
    //     // 最终还是调render-wen提供的render函数，渲染toJSON
    //     return render(json, { ...options, ...options2, rootId, env, _isNestedRender: true, _context: this })
    //   }
    // } else {
    //   const renderModule = env.renderModule
    //   env.renderModule = (json: any, options2: any) => {
    //     const rootId1 = options.rootId
    //     const rootId2 = options2.rootId
    //     let rootId = rootId1 || rootId2;
    //     if (rootId1 && rootId2) {
    //       rootId = rootId1 + '_' + rootId2
    //     }
    //     // 最终还是调render-wen提供的render函数，渲染toJSON
    //     return renderModule(json, { ...options, ...options2, rootId, env, _isNestedRender: true, _context: this })
    //   }
    // }
    env.renderModule = (json: any, options2: any) => {
      const rootId1 = options.rootId
      const rootId2 = options2.rootId
      let rootId = rootId1 || rootId2;
      if (rootId1 && rootId2) {
        rootId = rootId1 + '_' + rootId2
      }
      // 最终还是调render-wen提供的render函数，渲染toJSON
      return render(json, { ...options, ...options2, rootId, env, _isNestedRender: true, _context: this })
    }
    if (!env.renderCom) {
      env.renderCom = (json: any, options2: any) => {
        // 最终还是调render-wen提供的render函数，渲染toJSON
        return render(json, { ...options, ...options2, _isNestedRender: true, _isNestCom: true, _context: this })
      }
    } else {
      const renderCom = env.renderCom
      env.renderCom = (json: any, options2: any) => {
        // 最终还是调render-wen提供的render函数，渲染toJSON
        return renderCom(json, { ...options, ...options2, _isNestedRender: true, _isNestCom: true, _context: this })
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
    // // render-web知道一定存在env.callConnector，用于“服务接口”组件
    // const callConnector = env.callConnector
    // // TODO: 性能面板，作为插件注入
    // if (typeof callConnector === 'function') {
    //   // 劫持callConnector获取执行时间和执行信息，写入性能面板
    //   env.callConnector = (connector: any, params: any, connectorConfig: any) => {
    //     const start = new Date().getTime()
    //     let end: any = null
    //     const connectorTime: any = {
    //       basicInformation: {
    //         connector, params, connectorConfig
    //       },
    //       start,
    //       type: 'success'
    //     }
    //     return new Promise((resolve, reject) => {
    //       callConnector(connector, params, connectorConfig).then((res: any) => {
    //         end = new Date().getTime()
    //         resolve(res)
    //       }).catch((err: any) => {
    //         end = new Date().getTime()
    //         connectorTime.type = 'error'
    //         reject(err)
    //       }).finally(() => {
    //         connectorTime.end = end
    //         connectorTime.time = end - start
    //         this.setPerformanceCallConnectorTimes(connectorTime)
    //       })
    //     })
    //   }
    // }
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
    // const arr = [new Debugger()]
    // arr.concat(plugins).forEach((plugin) => {
    //   plugin.apply(this)
    // })
  }

  // 初始化其它信息
  initOther() {
    const { env } = this.options
    // 是否打印IO输入输出的数据信息
    // TODO: 通过options传入，而非env
    // if (!!env.silent) {
    //   // 调试模式下有debugger，所以无论silent设置，都没有影响
    //   if (!localStorage.getItem("MYBRICKS_LOG")) {
    //     setLoggerSilent();
    //   }
    // }
    // 是否显示错误通知
    // TODO: 通过options传入，而非env
    // Notification.init(env.showErrorNotification);

    // 这里看看怎么做成插件的形式
    this.logger = {
      info: console.info,
      trace: console.trace,
      warn: console.warn,
      error: (e: any) => {
        console.error(e);
        // Notification.error(e);
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
    const comLibs = [...((window as any)["__comlibs_edit_"] || []), ...((window as any)["__comlibs_rt_"] || [])];

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
    const rtn = comDefs[def.namespace + '-' + def.version] || comDefs[def.namespace]
    if (!rtn) {
      const ary = []
      for (const ns in comDefs) {
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

export class Stylization {
  options: any;
  /** 挂载节点 */
  root: any;
  /** 唯一标识 */
  rootId: any;
  /** ID到style标签的映射 */
  // styleMap: any = {};

  /** 组件默认样式，仅触发一次 */
  // comMap: any = {};

  constructor({ rootId, root, options, onCompleteCallBacks }: any) {
    this.root = root;
    this.rootId = rootId
    this.options = options
    const { _cssMap } = this;

    const destory = () => {
      Object.entries(_cssMap).forEach(([_, style]) => {
        root.removeChild(style.tag);
      })
    }

    onCompleteCallBacks.push(destory)
  }

  /** 查找是否添加过组件的默认风格化配置 */
  private _defaultStyleMap: Record<string, boolean> = {}

  /** 判断是否添加过默认风格化配置 */
  hasDefaultStyle(id: string) {
    return this._defaultStyleMap[id];
  }

  /** 标记组件ID已经添加过风格化配置 */
  setDefaultStyle(id: string) {
    this._defaultStyleMap[id] = true;
  }

  /** 
   * styleId到样式信息的映射
   * @example
   * const _cssMap = {
   *  styleId: {
   *    tag: <style />,
   *    css: {
   *      "selector": {
   *        "background-color": "red"
   *      },
   *      ...
   *    }
   *  }
   * }
   */
  private _cssMap: Record<string, Record<string, Record<string, any>>> = {}
  
  /** 设置样式 */
  setStyle(id: string, style: any) {
    let styleAry = [] as {css: string, selector: string, global?: boolean }[];

    // TODO: 处理global
    // const obj = {
    //   ":global.button": {
    //     "backgroundColor": "pink",
    //     "borderTopColor": "rgba(114,46,209,1)",
    //     "borderRightColor": "rgba(114,46,209,1)",
    //     "borderBottomColor": "rgba(114,46,209,1)",
    //     "borderLeftColor": "rgba(114,46,209,1)"
    //   },
    // }

    if (Array.isArray(style)) {
      styleAry = style;
    } else {
      Object.entries(style).forEach(([selector, css]: any) => {
        styleAry.push({
          selector,
          css
        })
      })
    }

    const splitIds = id.split("-")
    const comId = splitIds[splitIds.length - 1]

    if (styleAry.length) {
      const { rootId, root, options } = this;
      const { env, handlePxToVw, debug } = options
      const { pxToRem: configPxToRem } = env
      const prefix = debug ? "#_geoview-wrapper_ ": ""

      const styleMap: any = {};
      styleAry.forEach(({css, selector, global}) => {
        if (selector === ':root') {
          selector = '> *:first-child'
        }
        (Array.isArray(selector) ? selector : [selector]).forEach((selector) => {
          const cssSelector = `${prefix}${global ? '' : `#${comId}[data-nested-id="${id}"] `}${selector.replace(/\{id\}/g, `${comId}`)}`
          const style: Record<string, any> = {};
          Object.entries(css).forEach(([key, value]) => {
            if (configPxToRem && typeof value === 'string' && value.indexOf('px') !== -1) {
              value = pxToRem(value)
            } else if (handlePxToVw && typeof value === 'string' && value.indexOf('px') !== -1) {
              value = handlePxToVw(value)
            }
            style[convertCamelToHyphen(key)] = value
          })
          // styleMap[cssSelector] = style;
          // 如果有同名，后添加的权重更高，覆盖前者
          if (!styleMap[cssSelector]) {
            styleMap[cssSelector] = style
          } else {
            styleMap[cssSelector] = Object.assign(styleMap[cssSelector], style)
          }
        })
      })

      const _css = this._cssMap[id];

      if (!_css) {
        const styleTag = document.createElement('style');
        this._cssMap[id] = {
          tag: styleTag,
          css: styleMap
        }
        root.appendChild(styleTag);

        Object.entries(styleMap).forEach(([key, value]: any) => {
          styleTag.sheet!.insertRule(`${key} {${Object.entries(value).map(([key, value]) => {
            return `${key}: ${value};`
          }).join("")}}`)
        })
      } else {
        const { tag: styleTag, css } = _css;
        const cssRulesMap: any = Array.from(styleTag.sheet.cssRules).reduce((p: any, c: any) => {
          p[c.selectorText] = c;
          return p;
        }, {});
        Object.entries(styleMap).forEach(([key, value]: any) => {
          const cssRuleStyle = cssRulesMap[key]?.style;
          if (cssRuleStyle) {
            const style = css[key];
            Object.entries(value).forEach(([key, value]) => {
              style[key] = value;
              cssRuleStyle[key] = value;
            })
          } else {
            css[key] = value;
            styleTag.sheet!.insertRule(`${key} {${Object.entries(value).map(([key, value]) => {
              return `${key}: ${value};`
            }).join("")}}`)
          }
        })
      }
    }
  }
}

const render = (json: any, options?: any) => {
  // return h(MIndex, {
  //   json,
  //   options
  // })
  if (!options.sceneOpenType) {
    options.sceneOpenType = "redirect"
  }

  if (!json) {
    return null
  } else {
    let jsx = null
    let props = {}
    if ("scenes" in json)  {
      jsx = MMultiScene
      props = {
        json,
        options
      }
    } else {
      if (json.slot) {
        jsx = MMain
        props = {
          json,
          options,
          root: json.type === 'module' ? false : true
        }
      }
    }
    if (!jsx) {
      // TODO: 这里是运行纯函数的模版
      // const _context = new Context(options, json)
      const _context = options._isNestedRender ? options._context : new Context(options, json)

      executor({
        json,
        getComDef: (def: any) => _context.getComDef(def),
        // @ts-ignore
        events: options.events,
        env: options.env,
        ref(_refs: any) {
          if (typeof options.ref === 'function') {
            options.ref(_refs)
          } else {
            const { inputs } = _refs
            const jsonInputs = (json as ToJSON).inputs
            if (inputs && Array.isArray(jsonInputs)) {
              jsonInputs.forEach((input) => {
                const { id, mockData, type, extValues } = input
                let value = void 0
                if (options.debug) {
                  if (type === "config" && extValues?.config && "defaultValue" in extValues.config) {
                    try {
                      value = JSON.parse(decodeURIComponent(extValues.config.defaultValue))
                    } catch {
                      value = extValues.config.defaultValue
                    }
                  } else {
                    try {
                      value = JSON.parse(decodeURIComponent(mockData))
                    } catch {
                      value = mockData
                    }
                  }
                }
                inputs[id](value)
              })
            }
            _refs.run()
          }
        },
        onError: _context.onError,
        debug: options.debug,
        debugLogger: options.debugLogger,
        logger: _context.logger,
        scenesOperate: options.scenesOperate,
        _isNestedRender: options._isNestedRender,
        _isNestCom: options._isNestCom,
        _context
      }, {
        observable: _context.observable
      })
      return null
    }

    if (options._isNestCom) {
      // rendercom渲染，是个画布，需要将当前env透传
      const env = deepCopy(options.env);
      // let modules;
      // const jsonModules = json.modules
      // if (jsonModules) {
      //   modules = new Modules(jsonModules)
      // }

      props.ModuleContext = {env}

      // provide(ModuleContext, {
      //   env
      // })
    }
    
    // 如果是嵌套渲染，不再重复嵌套Provider
    if (options._isNestedRender) {
      // 嵌套渲染，直接return即可
      // return jsx
      return h(jsx, props)
    }
    // let modules;
    // const jsonModules = json.modules
    // if (jsonModules) {
    //   modules = new Modules(jsonModules)
    // }
    
    if (!("scenes" in json) && json.type === "module") {
      // 非多场景的module，说明是引擎搭建态的模块，把edit设置为null
      options.env.edit = null;
    }

    // provide(MyBricksRenderContext, new Context(options, json))
    props.MyBricksRenderContext = new Context(options, json)
    // provide(ModuleContext, {
    //   env: options.env
    // })
    props.ModuleContext = {
      env: options.env
    }

    return h(jsx, props)
  }
}

export default render
