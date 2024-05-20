import { ToJSON } from "@mybricks/render-types";

/**
 * 处理应用入口
 * TODO:
 *  - 页面用react-router
 *  - popup类再包装一层，通过useState控制true/false（显示/隐藏）
 */
export function handleAppEntry(toJSON: ToJSON) {
  const { scenes } = toJSON;
  return `import React from "react";

  import { MyBricksRenderProvider, SceneProvider } from "@mybricks/render-react-hoc";

  import globalContext from "@/globalContext"
  import { ${scenes.reduce(
    (p, c) => (p ? `${p}, Slot_${c.id}` : `Slot_${c.id}`),
    "",
  )} } from "@/slots";
  
  export default function App() {
    return (
      <MyBricksRenderProvider value={globalContext}>
        ${scenes.reduce(
          (p, c) =>
            p + `{/* ${c.title} */}
              <SceneProvider value="${c.id}">
                <Slot_${c.id} />
              </SceneProvider>
            `,
          "",
        )}
      </MyBricksRenderProvider>
    );
  }
  `;
  // return `import React, { useMemo, useState } from "react";

  // import { MyBricksRenderProvider, SceneProvider } from "@mybricks/render-react-hoc";

  // import globalContext from "@/globalContext"
  // import { ${scenes.reduce(
  //   (p, c) => (p ? `${p}, Slot_${c.id}` : `Slot_${c.id}`),
  //   "",
  // )} } from "@/slots";
  
  // export default function App() {
  //   const [, refresh] = useState(0)
  //   const scenesMap = useMemo(() => {
  //     globalContext.setScenesRefresh(refresh)
  //     return globalContext.scenesMap
  //   }, [])
  
  //   return (
  //     <MyBricksRenderProvider value={globalContext}>
  //       ${scenes.reduce(
  //         (p, c) =>
  //           p + `{/* ${c.title} */}\n{scenesMap['${c.id}'].show && (
  //             <SceneProvider value="${c.id}">
  //               <Slot_${c.id} />
  //             </SceneProvider>
  //           )}`,
  //         "",
  //       )}
  //     </MyBricksRenderProvider>
  //   );
  // }
  // `;
}
