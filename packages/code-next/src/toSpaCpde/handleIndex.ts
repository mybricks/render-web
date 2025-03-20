import toCode from "../toCode";
import { validateScenePopup } from "../toCode/event/utils";

/** 处理单页主入口 */
const handleIndex = (code: ReturnType<typeof toCode>["scenes"]) => {
  return `// 当前出码未支持能力：模块，插件能力，风格化，AI组件
        // 组件库依赖：react@18 react-dom@18 antd@4 moment@2 @ant-design/icons@4
        // 请先执行以下命令以安装组件库npm包
        // npm i @mybricks/comlib-basic@0.0.7-next.5 @mybricks/comlib-pc-normal@0.0.22-next.7 @mybricks/render-react-hoc@0.0.1-next.11
        import React, { useMemo, createContext } from 'react';
        import { Provider, useCanvasState } from '@mybricks/render-react-hoc';
        ${code
          .map(({ scene }) => {
            return `import Scene_${scene.id} from './scenes/Scene_${scene.id}';`;
          })
          .join("\n")}

        export const GlobalContext = createContext({});
  
        export default function () {
          const [canvasState, canvasIO] = useCanvasState({
            ${code
              .map(({ scene }, index) => {
                return `${scene.id}: {
                 mounted: ${index === 0 ? "true" : "false"},
                  visible: ${index === 0 ? "true" : "false"},
                  type: "${scene.type}",
              }`;
              })
              .join(",")}
          });
  
          const global = useMemo(() => {
            const global = {
              fx: {},
              var: {},
              canvas: canvasIO,
            };
            global.fx = {};
            global.var = {};
            return global;
          }, []);
  
          const value = useMemo(() => {
            return {
              env: {
                runtime: true,
                i18n: (value) => value,
              },
              canvasState,
              canvasIO,
            };
          }, []);
  
          return (
            <Provider value={value}>
              <GlobalContext.Provider value={global}>
                ${code
                  .map(({ scene }) => {
                    return `{canvasState.${scene.id}.mounted && (
                    <Scene_${scene.id} ${validateScenePopup(scene) ? "" : `visible={canvasState.${scene.id}.visible}`} />
                  )}`;
                  })
                  .join("\n")}
              </GlobalContext.Provider>
            </Provider>
          );
        }
      `;
};

export default handleIndex;
