/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import ReactDOM from "react-dom";

import { getStylesheetMountNode } from "../../../../core/utils";

import lazyCss from "./style.lazy.less";

const css: any = lazyCss.locals;
const resumeIcon = (
  <svg
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    p-id="10635"
    width="12"
    height="12"
  >
    <path
      d="M219.428571 73.142857v877.714286H73.142857V73.142857zM365.714286 73.142857l585.142857 438.857143-577.828572 438.857143L365.714286 599.771429"
      p-id="10636"
      fill="#707070"
    ></path>
  </svg>
);

function DebuggerPanel({ resume }: any) {
  return (
    <div className={css.debugger}>
      <div className={css.titlebar}>
        <div>已在交互视图中暂停</div>
        <div className={css.resume} onClick={resume}>
          {resumeIcon}
        </div>
      </div>
    </div>
  );
}

interface DebugBreakpointParams {
  conId: string;
}

export default class MyBricksRenderDebugger {
  constructor() {}

  apply(context: any) {
    const { options, mode } = context;
    const { env, debug, onError } = options;
    if (mode === "development" && typeof debug === "function") {
      const debuggerPanel = new Debugger(env);
      const { log, onResume } = debug({
        // 点击逻辑面板下一步
        resume: () => {
          debuggerPanel.next();
        },
        // 点击逻辑面板忽略所有断点
        ignoreAll: (bool: boolean) => {
          debuggerPanel.setIgnoreWait(bool);
          if (bool) {
            // 忽略调试，全部执行完
            debuggerPanel.next(true);
          }
        },
        breakpoint: {
          add(params: DebugBreakpointParams) {
            debuggerPanel.addBreakpointByConnectionId(params);
          },
          remove(params: DebugBreakpointParams) {
            debuggerPanel.removeBreakpointByConnectionId(params);
          },
        },
      });
      // 点击调试面板下一步执行onResume
      debuggerPanel.setResume(onResume);
      context.debuggerPanel = debuggerPanel;
      // 调试时与引擎逻辑面板交互，调用options的debugLogger来实现
      options.debugLogger = log;

      // 引擎环境内引擎提供onError，目前用于逻辑面板计算组件的报错ui展示
      context.onError = onError;
      lazyCss.use({ target: getStylesheetMountNode() });
    }
  }
}

class Debugger {
  dom: any;
  canvas: any;
  root: any;

  // @ts-ignore
  isReact18 = !!ReactDOM.createRoot;

  resume = () => {};

  constructor(private env: any) {}

  setResume(resume: any) {
    this.resume = resume;
  }

  open() {
    if (!this.dom) {
      const div = document.createElement("div");
      const canvas = this.env.canvasElement;
      this.canvas = canvas;
      this.dom = div;
      div.style.position = "absolute";
      div.style.width = "100%";
      div.style.height = "100%";
      div.style.top = "0";
      div.style.left = "0";
      div.style.zIndex = "100000";
      div.style.visibility = "visible";
      canvas.appendChild(div);
      if (this.isReact18) {
        // @ts-ignore
        const root = ReactDOM.createRoot(div);
        root.render(<DebuggerPanel resume={this.resume} />);
        this.root = root;
      } else {
        ReactDOM.render(<DebuggerPanel resume={this.resume} />, div);
      }
    } else {
      this.dom.style.visibility = "visible";
    }
  }
  close() {
    if (this.dom) {
      this.dom.style.visibility = "hidden";
    }
  }
  destroy() {
    if (this.dom) {
      requestAnimationFrame(() => {
        if (this.isReact18) {
          this.root.unmount();
        } else {
          ReactDOM.unmountComponentAtNode(this.dom);
        }
        this.root = null;
        this.canvas.removeChild(this.dom);
        this.canvas = null;
        this.dom = null;
      });
    }
  }

  private _ignoreWait = false;
  private effectiveBreakpoints = new Set<string>();
  private brokenBreakpoints = new Set<string>();

  /** 断点等待堆栈 */
  private stack: any[] = [];
  /** 唯一标识到stack的映射 */
  private runMarkToStack = new Map();
  private stackToRunMark = new Map();

  /** 当前运行的唯一标识 */
  private runMark: number = 0;
  /** 断点等待 */
  private pending = false;

  /** 用于唯一标识 */
  private waitCount = 1;

  hasBreakpoint(connection: any) {
    return (
      !this._ignoreWait && (this.pending || this.checkIsBreakpoint(connection))
    );
  }

  checkIsBreakpoint(connection: any) {
    return (
      (connection.isBreakpoint && !this.brokenBreakpoints.has(connection.id)) ||
      // 原始未标记断点 & 被标记
      (!connection.isBreakpoint && this.effectiveBreakpoints.has(connection.id))
    );
  }

  wait(connection: any, cb: any) {
    return new Promise((resolve: any) => {
      if (this._ignoreWait) {
        resolve();
      } else {
        if (!this.pending) {
          const waitCount = this.waitCount++ + connection.id;
          this.pending = true;
          // 当前没有在等待
          // 1. 唤起引擎断点
          // 2. 说明连线本身是断点状态
          cb();
          const stack = {
            id: waitCount,
            resolves: [resolve],
          };

          this.stackToRunMark.set(stack, waitCount);
          this.runMarkToStack.set(waitCount, stack);

          const runStack = this.runMarkToStack.get(this.runMark);
          if (runStack) {
            if (runStack.cb) {
              // 说明是断点，重新压入堆栈
              this.stack.unshift(runStack);
            } else {
              stack.resolves.push(...runStack.resolves);
              this.runMark = waitCount;
            }

            this.stack.unshift(stack);
          } else {
            this.stack.push(stack);
          }
        } else {
          // 在等待
          // 判断当前连线本身是否断点状态
          if (this.checkIsBreakpoint(connection)) {
            // 是
            const waitCount = this.waitCount++ + connection.id;
            const stack = {
              id: waitCount,
              cb,
              resolves: [resolve],
            };
            this.stackToRunMark.set(stack, waitCount);
            this.runMarkToStack.set(waitCount, stack);
            this.stack.push(stack);
          } else {
            // 否，写入当前runMark下
            if (this.runMark) {
              const stack = this.runMarkToStack.get(this.runMark);
              stack.resolves.push(resolve);
            } else {
              const stack = this.stack[0];
              stack.resolves.push(resolve);
            }
          }
        }

        // 打开ui面板
        this.open();
      }
    });
  }

  async next(nextAll = false) {
    const stack = this.stack.shift();
    this.pending = false;
    const runMark = this.stackToRunMark.get(stack);
    this.runMark = runMark;

    while (!this.pending && stack.resolves.length) {
      const resolve = stack.resolves.shift();
      resolve();
      await new Promise((r) => r(1));
    }

    this.runMark = 0;

    if (!stack.resolves.length) {
      // 全部执行结束，清除缓存
      this.runMarkToStack.delete(runMark);
      this.stackToRunMark.delete(stack);
      this.runMark = 0;
    }

    if (this.pending) {
      // 有等待，直接结束
      return;
    }

    if (!this.stack.length) {
      // 堆栈清空，关闭ui面板
      this.close();
    } else {
      // 调起新的debug面板
      const stack = this.stack[0];
      stack.cb();
      Reflect.deleteProperty(stack, "cb");
      this.pending = true;
      if (nextAll) {
        this.next(nextAll);
      }
    }

    this.runMark = 0;
  }

  async run() {
    while (this.stack.length) {
      const next = this.stack.pop();
      await next;
    }
  }

  setIgnoreWait(bool: boolean) {
    this._ignoreWait = bool;
  }

  addBreakpointByConnectionId(params: DebugBreakpointParams) {
    const { conId } = params;
    this.effectiveBreakpoints.add(conId);
    this.brokenBreakpoints.delete(conId);
  }

  removeBreakpointByConnectionId(params: DebugBreakpointParams) {
    const { conId } = params;
    this.effectiveBreakpoints.delete(conId);
    this.brokenBreakpoints.add(conId);
  }
}
