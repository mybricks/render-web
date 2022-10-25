# Mybricks web渲染器

```jsx
import {render} from 'react-dom'
import {render as renderUI} from '@mybricks/render-web'


render(<Page/>, document.querySelector('#root'))

function Page() {
 return (
         <div>
          {
           renderUI({
            json: json,//设计器toJSON结果
            env: {//配置组件运行的各类环境信息
             i18n(text) {//多语言
              return text
             }
            }
           })
          }
         </div>
 )
}

```

