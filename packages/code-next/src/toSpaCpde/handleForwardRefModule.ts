import {
  createDependencyImportCollector,
  generateImportDependenciesCode,
} from "./utils";
import handleCom from "./handleCom";
import handleDom from "./handleDom";
import handleModule from "./handleModule";
import {
  handleEffectEvent,
  handleFxsEvent,
  handleVarsEvent,
  handleSlotContext,
} from "./handleSlot";

import type { UI, BaseConfig } from "./index";

interface HandleForwardRefModuleConfig extends BaseConfig {
  addParentDependencyImport?: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addRefName?: (refName: string) => void;
  addSlotContext?: (slotContext: string) => void;
  checkIsRoot: () => boolean;
  getSlotRelativePathMap: () => Record<string, string>;
}

const handleForwardRefModule = (
  ui: UI,
  config: HandleForwardRefModuleConfig,
) => {
  const [dependencyImport, addDependencyImport] =
    createDependencyImportCollector();
  addDependencyImport({
    packageName: "react",
    dependencyName: "React",
    importType: "default",
  });
  const { props, children } = ui;
  const propsCode = Object.entries(props).reduce((pre, [key, value]) => {
    return pre + `${key}={${JSON.stringify(value)}} `;
  }, "");

  let uiCode = "";
  let jsCode = "";

  console.log("🧱 模块 ui => ", ui);

  // if (ui.meta.scope) {

  // } else {
  //   // 生命的组件ref
  const refNames = new Set<string>();
  // 需要导入使用的slotContext，调用上层组件的ref
  const slotContexts = new Set<string>();
  const nextConfig = {
    ...config,
    addRefName:
      config.addRefName ||
      ((refName: string) => {
        refNames.add(refName);
      }),
    addParentDependencyImport: addDependencyImport,
    addSlotContext: (slotContext: string) => {
      slotContexts.add(slotContext);
    },
  };

  children.forEach((child) => {
    if (child.type === "com") {
      const { ui, js } = handleCom(child, nextConfig);
      uiCode += ui;
      jsCode += js;
    } else if (child.type === "module") {
      const { ui, js } = handleModule(child, nextConfig);
      uiCode += ui;
      jsCode += js;
    } else {
      const { ui } = handleDom(child, nextConfig);
      uiCode += ui;
    }
  });

  //   if (config.checkIsRoot()) {
  // root 或 scope 需要添加文件
  addDependencyImport({
    packageName: "react",
    dependencyName: "useMemo",
    importType: "named",
  });
  addDependencyImport({
    packageName: "react",
    dependencyName: "useEffect",
    importType: "named",
  });
  addDependencyImport({
    packageName: "react",
    dependencyName: "createContext",
    importType: "named",
  });
  addDependencyImport({
    packageName: "react",
    dependencyName: "useContext",
    importType: "named",
  });
  addDependencyImport({
    packageName: "react",
    dependencyName: "forwardRef",
    importType: "named",
  });
  addDependencyImport({
    packageName: "@mybricks/render-react-hoc",
    dependencyName: "useVar",
    importType: "named",
  });
  addDependencyImport({
    packageName: "@mybricks/render-react-hoc",
    dependencyName: "merge",
    importType: "named",
  });
  addDependencyImport({
    packageName: "@mybricks/render-react-hoc",
    dependencyName: "Module",
    importType: "named",
  });

  // 主场景和作用域插槽会有生命周期事件
  const effectEventCode = handleEffectEvent(ui, {
    ...config,
    getParams: (paramPins) => {
      return paramPins.reduce((pre: Record<string, string>, { id, type }) => {
        if (type === "config") {
          pre[id] = `props.data.${id}`;
        } else {
          pre[id] = `ref.current.inputs.${id}`;
        }
        return pre;
      }, {});
    },
    addParentDependencyImport: addDependencyImport,
    addSlotContext: (slotContext: string) => {
      slotContexts.add(slotContext);
    },
  });

  const { varDeclarationCode, varAssignmentCode } = handleVarsEvent(ui, {
    ...config,
    addParentDependencyImport: addDependencyImport,
    addSlotContext: (slotContext: string) => {
      slotContexts.add(slotContext);
    },
  });

  const { fxDeclarationCode, fxAssignmentCode } = handleFxsEvent(ui, {
    ...config,
    addParentDependencyImport: addDependencyImport,
    addSlotContext: (slotContext: string) => {
      slotContexts.add(slotContext);
    },
  });

  const { importSlotContextCode, useSlotContextCode } = handleSlotContext(ui, {
    ...config,
    slotContexts,
  });

  config.add({
    path: `${config.getPath()}/index.tsx`,
    content: `${generateImportDependenciesCode(dependencyImport)}
        ${importSlotContextCode}

        export const SlotContext = createContext({});

        export default forwardRef((props, ref) => {
          ${useSlotContextCode}
          ${Array.from(refNames)
            .map((refName) => `const ${refName}_ref = useRef();`)
            .join("\n")}
          ${varDeclarationCode}
          ${fxDeclarationCode}
          ${jsCode}

          const slotContextValue = useMemo(() => {
            return {
              comRef: {
                ${Array.from(refNames)
                  .map((refName) => `${refName}_ref,`)
                  .join("\n")}
              },
              fx: {${fxAssignmentCode}},
              var: {${varAssignmentCode}},
            };
          }, []);

          ${effectEventCode}

          return (
            <SlotContext.Provider value={slotContextValue}>
              <Module ref={ref} {...props}>
                <div ${propsCode}>${uiCode}</div>
              </Module>
            </SlotContext.Provider>
          )
        })
        `,
  });
  //   }
  //   return {
  //     js: jsCode,
  //     ui: `<div ${propsCode}>${uiCode}</div>`,
  //   };
  // }
};

export default handleForwardRefModule;
