import React from "react"
import { createRoot } from "react-dom"
import lazyCss from './style.lazy.less';

const css: any = lazyCss.locals;

const resumeIcon = <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14919" width="10" height="10"><path d="M260.68992 89.23648v845.20448c0 44.64128 49.49504 71.5008 86.92736 47.17568l650.15808-422.6048c34.13504-22.19008 34.13504-72.16128 0-94.34624L347.61728 42.0608c-37.4272-24.33024-86.92736 2.52928-86.92736 47.17568z m112.52736 103.59808l490.5472 318.976-490.5472 318.90432V192.83456zM56.88832 32.9728c28.48256 0 52.02432 21.16608 55.75168 48.62464l0.512 7.63904v845.20448c0 31.07328-25.1904 56.26368-56.26368 56.26368-28.48256 0-52.0192-21.16608-55.75168-48.62976l-0.512-7.63392V89.23136c0-31.06816 25.1904-56.25856 56.2688-56.25856z" fill="#140F26" p-id="14920"></path></svg>

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
