import React from "react"
import ReactDOM from "react-dom"
import lazyCss from './style.lazy.less';

const css: any = lazyCss.locals;

const resumeIcon = <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10635" width="12" height="12"><path d="M219.428571 73.142857v877.714286H73.142857V73.142857zM365.714286 73.142857l585.142857 438.857143-577.828572 438.857143L365.714286 599.771429" p-id="10636" fill="#707070"></path></svg>

export default function Debugger({ resume }: any) {
  return (
    <div className={css.debugger}>
      <div className={css.titlebar}>
        <div>已在交互视图中暂停</div>
        <div className={css.resume} onClick={resume}>{resumeIcon}</div>
      </div>
    </div>
  )
}

export class DebuggerPanel {
  dom: any
  canvas: any
  root: any
  env: any

  isReact18 = !!ReactDOM.createRoot

  resume = () => {}

  constructor({ env }: any) {
    this.env = env
  }

  setResume(resume: any) {
    this.resume = resume
  }

  open() {
    if (!this.dom) {
      const div = document.createElement("div");
      const canvas = this.env.canvasElement
      this.canvas = canvas
      this.dom = div;
      div.style.position = 'absolute';
      div.style.width = "100%";
      div.style.height = "100%";
      div.style.top = '0';
      div.style.left = '0';
      div.style.zIndex = '100000';
      div.style.visibility = 'visible';
      canvas.appendChild(div);
      if (this.isReact18) {
        const root = ReactDOM.createRoot(div);
        root.render(<Debugger resume={this.resume}/>);
        this.root = root;
      } else {
        ReactDOM.render(<Debugger resume={this.resume}/>, div)
      }
    } else {
      this.dom.style.visibility = 'visible';
    }
  }
  close() {
    if (this.dom) {
      this.dom.style.visibility = 'hidden'
    }
  }
  destroy() {
    if (this.dom) {
      requestAnimationFrame(() => {
        if (this.isReact18) {
          this.root.unmount()
        } else {
          ReactDOM.unmountComponentAtNode(this.dom);
        }
        this.root = null
        this.canvas.removeChild(this.dom)
        this.canvas = null
        this.dom = null
      })
    }
  }

  private _pending = false
  private _ignoreWait = false
  private _waitCount = 0
  // 断点 unshift 入 pop 出
  private _waitBreakpointIds: any = []
  // 下一步
  private _waitIdToResolvesMap: any = {}

  hasBreakpoint(connection: any) {
    return !this._ignoreWait && (this._pending || connection.isBreakpoint)
  }

  wait(connection: any, cb: any) {
    return new Promise((resolve: any) => {
      if (this._ignoreWait) {
        resolve()
      } else {
        const waiting = this._waitBreakpointIds.length > 0

        if (!waiting) {
          cb()
        }

        this.open()
        this._pending = true;
        if (connection.isBreakpoint) {
          if (waiting) {
            const lastId = this._waitBreakpointIds[0]
            this._waitIdToResolvesMap[lastId].push(cb)
          }
          const id = (this._waitCount ++) + connection.id
          this._waitBreakpointIds.unshift(id)
          this._waitIdToResolvesMap[id] = [resolve]
        } else {
          const id = this._waitBreakpointIds[0]
          this._waitIdToResolvesMap[id].push(resolve)
        }
      }
    })
  }

  next(nextAll = false) {
    if (nextAll) {
      while (this._waitBreakpointIds.length) {
        this.next()
      }
    } else {
      const id = this._waitBreakpointIds.pop()
      const resolves = this._waitIdToResolvesMap[id]
      if (resolves) {
        resolves.forEach((resolve: any) => resolve())
      }
      if (!this._waitBreakpointIds.length) {
        this._pending = false
        this.close()
      }
    }
  }

  setIgnoreWait(bool: boolean) {
    this._ignoreWait = bool
  }
}
