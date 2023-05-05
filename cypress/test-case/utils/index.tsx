import React from 'react'
import Main from 'src/Main';
import { render } from '../../../src/index'

import { getJSONFromRXUIFile } from '@mybricks/file-parser'
import './comlib'

const options = {
  //渲染Mybricks toJSON的结果
  env: {
    //配置组件运行的各类环境信息
    i18n(text) {
      //多语言
      return text
    },
    getQuery() {
      return "aaa"
    },
    renderCom(json, opts, coms) {
      return new Promise((resolve) => {
        resolve(
          render(json, {
            comDefs: { ...coms },
            ...(opts || {}),
          }),
        );
      });
    },
    showErrorNotification: false,
    events: [
      //配置事件
      {
        type: "jump",
        title: "跳转到",
        exe({ options }) {
          const page = options.page
          if (page) {
            window.location.href = page
          }
        },
      },
    ],
  },
}

function renderTestPage(json) {
  return <Main json={getJSONFromRXUIFile(json.content)} opts={options}/>
}

export default renderTestPage