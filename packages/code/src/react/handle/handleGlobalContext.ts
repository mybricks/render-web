import { ToJSON } from "@mybricks/render-types";

/** 处理全局上下文信息 */
export function handleGlobalContext(code: string, toJSON: ToJSON) {
  return code.replace(
    "/** replace scenesMap */",
    `
    ${toJSON.scenes.reduce((p, c) => {
      const mapStr = `
          /** ${c.title} */
          "${c.id}": {
            show: ${!p ? "true" : "false"},
            todoList: [],
            inputsData: {},
            componentPropsMap: {},
            fromComponentProps: null,
          }
        `;
      return p ? `${p},\n${mapStr}` : mapStr;
    }, "")}
  `,
  );
}
