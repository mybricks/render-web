import React from "react"
import { createRoot } from "react-dom"
import lazyCss from './style.lazy.less';

const css: any = lazyCss.locals;

const resumeIcon = <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10635" width="12" height="12"><path d="M219.428571 73.142857v877.714286H73.142857V73.142857zM365.714286 73.142857l585.142857 438.857143-577.828572 438.857143L365.714286 599.771429" p-id="10636" fill="#707070"></path></svg>

export default function Debugger({ resume }: any) {
  return (
    <div className={css.debugger}>
      <div className={css.titlebar}>
        <div>已在调试程序中暂停</div>
        <div className={css.resume} onClick={resume}>{resumeIcon}</div>
      </div>
    </div>
  )
}

export class DebuggerPanel {
  dom: any
  canvas: any
  root: any

  resume = () => {}

  constructor({ resume }: any) {
    this.resume = resume
  }

  open(canvas: any) {
    if (!this.dom) {
      const div = document.createElement("div");
      this.canvas = canvas;
      this.dom = div;
      div.style.position = 'absolute';
      div.style.width = "100%";
      div.style.height = "100%";
      div.style.top = '0';
      div.style.left = '0';
      div.style.zIndex = '100000';
      div.style.visibility = 'visible';
      canvas.appendChild(div);
      const root = createRoot(div);
      root.render(<Debugger resume={this.resume}/>);
      this.root = root;
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
        this.root.unmount()
        this.root = null
        this.canvas.removeChild(this.dom)
        this.canvas = null
        this.dom = null
      })
    }
  }
}
