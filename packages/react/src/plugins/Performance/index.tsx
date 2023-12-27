import React from "react"
import ReactDOM from "react-dom"

import { getStylesheetMountNode } from "../../../../core/utils"

// import lazyCss from './style.lazy.less';

// const css: any = lazyCss.locals;
const resumeIcon = <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10635" width="12" height="12"><path d="M219.428571 73.142857v877.714286H73.142857V73.142857zM365.714286 73.142857l585.142857 438.857143-577.828572 438.857143L365.714286 599.771429" p-id="10636" fill="#707070"></path></svg>

function PerformancePanel({ resume }: any) {
  return (
    <div>
      性能面板
    </div>
    // <div className={css.debugger}>
    //   <div className={css.titlebar}> 
    //     <div>已在交互视图中暂停</div>
    //     <div className={css.resume} onClick={resume}>{resumeIcon}</div>
    //   </div>
    // </div>
  )
}

export default class MyBricksRenderPerformance {
  // TODO: 性能面板，作为插件注入，加一个开关（例如localStorage
  // private performance: any = {
  //   render: {
  //     // @ts-ignore
  //     // 开始
  //     start: window.MYBRICKS_PC_FMP_START || new Date().getTime(),
  //     // 结束
  //     end: null,
  //     // 耗时
  //     time: null
  //   },
  //   // 连接器数据收集（耗时，配置信息）
  //   callConnectorTimes: []
  // }

  

  constructor() {}

  apply(context: any) {
    const open = localStorage.getItem("MYBRICKS_RENDER_PERFORMANCE_DETECTION_MODE")
    const { options, mode } = context
    const { env, debug, onError } = options

    if (open && mode === "production") {
      console.log("开启性能检测模式，该模式本身会有额外的性能开销");
    }
  }
}

// 


class Performance {
  
}
