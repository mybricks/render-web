import React, { createRef } from "react"
import ReactDOM from "react-dom"
import lazyCss from './style.lazy.less';
import { observable as defaultObservable } from '../';

const css: any = lazyCss.locals;

export default function Performance({ resume }: any) {
  return (
    <div className={css.performance}>
      性能数据面板
    </div>
  )
}

export class PerformancePanel {
  dom: any
  canvas: any
  root: any
  env: any

  isReact18 = !!ReactDOM.createRoot


  private performance: any = {
    render: {
      // @ts-ignore
      // start: window.MYBRICKS_PC_FMP_START || new Date().getTime(),
      start: null,
      end: null,
      time: null
    },
    callConnectorTimes: []
  }

  domRef: any

  constructor({ env, observable }: any) {
    // this.performance = (observable || defaultObservable)({
    //   render: {
    //     // @ts-ignore
    //     start: window.MYBRICKS_PC_FMP_START || new Date().getTime(),
    //     end: null,
    //     time: null
    //   },
    //   callConnectorTimes: []
    // })
    /** 函数劫持 */
    const callConnector = env.callConnector
    if (typeof callConnector === 'function') {
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
            console.log("成功: ", res)
            end = new Date().getTime()
            resolve(res)
          }).catch((err: any) => {
            console.log("错误: ", err)
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
    window["RENDER_WEB_PERFORMANCE"] = {
      getPerformance: this.getPerformance.bind(that)
    }
  }

  open() {
    if (!this.dom) {
      const div = document.createElement("div");
      this.dom = div;
      const domRef = createRef()
      this.domRef = domRef
      div.style.position = 'fixed';
      // div.style.width = "300px";
      // div.style.height = "300px";
      div.style.width = "fit-content";
      div.style.height = "fit-content";
      div.style.right = '20px';
      div.style.bottom = '20px';
      div.style.zIndex = '100000';
      div.style.visibility = 'visible';
      document.body.appendChild(div)
      if (this.isReact18) {
        const root = ReactDOM.createRoot(div);
        root.render(<Performance />);
        this.root = root;
      } else {
        ReactDOM.render(<Performance />, div)
      }
    } else {
      this.dom.style.visibility = 'visible';
    }
  }
  close() {
    // if (this.dom) {
    //   this.dom.style.visibility = 'hidden'
    // }
  }
  destroy() {
    // if (this.dom) {
    //   requestAnimationFrame(() => {
    //     if (this.isReact18) {
    //       this.root.unmount()
    //     } else {
    //       ReactDOM.unmountComponentAtNode(this.dom);
    //     }
    //     this.root = null
    //     this.canvas.removeChild(this.dom)
    //     this.canvas = null
    //     this.dom = null
    //   })
    // }
  }
  getPerformance() {
    // this.open()
    return this.performance
  }

  setRender(type: "start" | "end", time: number) {
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
