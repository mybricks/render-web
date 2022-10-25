import {render as rxuiRender} from '@mybricks/rxui'
import Main from "./Main";

export function render({
                         json,
                         env,
                         dom
                       }: { json: { script, slot }, env?: {} }) {
  return (
    <div ref={el => {
      if (el) {
        rxuiRender(<Main json={json} env={env}/>, el)
      }
    }}/>
  )
}