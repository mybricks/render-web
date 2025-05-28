import {
  createDependencyImportCollector,
  generateImportDependenciesCode,
} from "./utils";
import handleCom, { handleProcess } from "./handleCom";
import handleDom from "./handleDom";
import handleModule from "./handleModule";

import type { UI, BaseConfig } from "./index";
import type { PinAry } from "../toCode/types";

interface HandleSlotConfig extends BaseConfig {
  addParentDependencyImport?: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addRefName?: (refName: string) => void;
  addSlotContext?: (slotContext: string) => void;
  checkIsRoot: () => boolean;
  getSlotRelativePathMap: () => Record<string, string>;
}

const handleSlot = (ui: UI, config: HandleSlotConfig) => {
  const [parentDependencyImport, addParentDependencyImport] =
    createDependencyImportCollector();
  addParentDependencyImport({
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

  if (ui.meta.scope) {
    const componentName = config.getComponentNameByNamespace(
      ui.meta.namespace!,
    );

    config.addParentDependencyImport!({
      packageName: `./${componentName}_${ui.meta.comId}/Slot_${ui.meta.slotId}`,
      dependencyName: `${componentName}_${ui.meta.comId}_${ui.meta.slotId}`,
      importType: "default",
    });

    // 生命的组件ref
    const refNames = new Set<string>();
    // 需要导入使用的slotContext，调用上层组件的ref
    const slotContexts = new Set<string>();
    const nextConfig = {
      ...config,
      addRefName: (refName: string) => {
        refNames.add(refName);
      },
      addParentDependencyImport,
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
        uiCode += "[TODO] 模块 33";
      } else {
        const { ui } = handleDom(child, nextConfig);
        uiCode += ui;
      }
    });

    addParentDependencyImport({
      packageName: "react",
      dependencyName: "useMemo",
      importType: "named",
    });
    addParentDependencyImport({
      packageName: "react",
      dependencyName: "useEffect",
      importType: "named",
    });
    addParentDependencyImport({
      packageName: "react",
      dependencyName: "createContext",
      importType: "named",
    });
    addParentDependencyImport({
      packageName: "react",
      dependencyName: "useContext",
      importType: "named",
    });
    addParentDependencyImport({
      packageName: "@mybricks/render-react-hoc",
      dependencyName: "useVar",
      importType: "named",
    });
    addParentDependencyImport({
      packageName: "@mybricks/render-react-hoc",
      dependencyName: "merge",
      importType: "named",
    });

    // 主场景和作用域插槽会有生命周期事件
    const effectEventCode = handleEffectEvent(ui, {
      ...config,
      getParams: (paramPins) => {
        return paramPins.reduce((pre: Record<string, string>, { id }) => {
          pre[id] = `slot.${id}`;
          return pre;
        }, {});
      },
      addParentDependencyImport,
      addSlotContext: (slotContext: string) => {
        slotContexts.add(slotContext);
      },
    });

    const { varDeclarationCode, varAssignmentCode } = handleVarsEvent(ui, {
      ...config,
      addParentDependencyImport,
      addSlotContext: (slotContext: string) => {
        slotContexts.add(slotContext);
      },
    });

    const { fxDeclarationCode, fxAssignmentCode } = handleFxsEvent(ui, {
      ...config,
      addParentDependencyImport,
      addSlotContext: (slotContext: string) => {
        slotContexts.add(slotContext);
      },
    });

    const { importSlotContextCode, useSlotContextCode } = handleSlotContext(
      ui,
      {
        ...config,
        slotContexts,
      },
    );

    config.add({
      path: `${config.getPath()}/${componentName}_${ui.meta.comId}/Slot_${ui.meta.slotId}/index.tsx`,
      content: `${generateImportDependenciesCode(parentDependencyImport)}
      ${importSlotContextCode}

      export const SlotContext_${ui.meta.comId}_${ui.meta.slotId} = createContext({});

      export default function ({ slot }) {
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
          <SlotContext_${ui.meta.comId}_${ui.meta.slotId}.Provider value={slotContextValue}>
            <div ${propsCode}>${uiCode}</div>
          </SlotContext_${ui.meta.comId}_${ui.meta.slotId}.Provider>
        )
      }
      `,
    });

    return {
      js: "",
      ui: `<${componentName}_${ui.meta.comId}_${ui.meta.slotId} id="${ui.meta.slotId}"/>`,
    };
  } else {
    // 生命的组件ref
    const refNames = new Set<string>();
    // 需要导入使用的slotContext，调用上层组件的ref
    const slotContexts = new Set<string>();
    const addDependencyImport =
      config.addParentDependencyImport || addParentDependencyImport;
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

    if (config.checkIsRoot()) {
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
      addParentDependencyImport({
        packageName: "react",
        dependencyName: "useContext",
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

      // 主场景和作用域插槽会有生命周期事件
      const effectEventCode = handleEffectEvent(ui, {
        ...config,
        getParams: (paramPins) => {
          slotContexts.add("GlobalContext");
          return paramPins.reduce((pre: Record<string, string>, { id }) => {
            pre[id] = `globalContext.canvas.${ui.meta.slotId}.inputs.${id}`;
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

      const { importSlotContextCode, useSlotContextCode } = handleSlotContext(
        ui,
        {
          ...config,
          slotContexts,
        },
      );

      config.add({
        path: `${config.getPath()}/index.tsx`,
        content: `${generateImportDependenciesCode(parentDependencyImport)}
        ${importSlotContextCode}

        export const SlotContext = createContext({});

        export default function ({ visible }) {
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
              <div ${propsCode}>${uiCode}</div>
            </SlotContext.Provider>
          )
        }
        `,
      });
    }
    return {
      js: jsCode,
      ui: `<div ${propsCode}>${uiCode}</div>`,
    };
  }
};

export default handleSlot;

interface HandleEffectEventConfig extends HandleSlotConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  getParams: (paramPins: PinAry) => Record<string, string>;
  addSlotContext: (slotContext: string) => void;
}

export const handleEffectEvent = (ui: UI, config: HandleEffectEventConfig) => {
  const isScope = ui.meta.scope;
  const effectEvent = config.getEffectEvent(
    isScope
      ? {
          comId: ui.meta.comId!,
          slotId: ui.meta.slotId,
        }
      : undefined,
  );

  return `useEffect(() => {
    ${handleProcess(effectEvent, {
      ...config,
      getParams: () => {
        return config.getParams(effectEvent.paramPins);
      },
    })}
  }, [])`;
};

interface HandleVarsEventConfig extends HandleSlotConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addSlotContext: (slotContext: string) => void;
}

export const handleVarsEvent = (ui: UI, config: HandleVarsEventConfig) => {
  const isScope = ui.meta.scope;
  const varEvents = config.getVarEvents(
    isScope
      ? {
          comId: ui.meta.comId!,
          slotId: ui.meta.slotId,
        }
      : undefined,
  );
  let varDeclarationCode = "";
  let varAssignmentCode = "";
  varEvents.forEach((varEvent) => {
    const code = handleProcess(varEvent, {
      ...config,
      getParams: () => {
        return {
          [varEvent.paramId]: "value",
        };
      },
    });
    const varName = `var_${varEvent.meta.id}`;

    varDeclarationCode += `const ${varName} = useVar(${JSON.stringify(varEvent.initValue)}, (value) => {
        ${code}
      });`;

    varAssignmentCode += `${varName},`;
  });

  return {
    varDeclarationCode,
    varAssignmentCode,
  };
};

interface HandleFxsEventConfig extends HandleSlotConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addSlotContext: (slotContext: string) => void;
}

export const handleFxsEvent = (ui: UI, config: HandleFxsEventConfig) => {
  const isScope = ui.meta.scope;
  const fxEvents = config.getFxEvents(
    isScope
      ? {
          comId: ui.meta.comId!,
          slotId: ui.meta.slotId,
        }
      : undefined,
  );
  let fxDeclarationCode = "";
  let fxAssignmentCode = "";
  fxEvents.forEach((fxEvent) => {
    const params = fxEvent.paramPins.reduce(
      (pre: Record<string, string>, paramPin, index: number) => {
        pre[paramPin.id] = `value${index}`;
        return pre;
      },
      {},
    );
    const code = handleProcess(fxEvent, {
      ...config,
      getParams: () => {
        return params;
      },
    });
    const fxName = `fx_${fxEvent.frameId}`;

    fxDeclarationCode += `const ${fxName} = (${fxEvent.paramPins
      .map((paramPin, index: number) => {
        if (paramPin.id in fxEvent.initValues) {
          return `value${index} = ${JSON.stringify(fxEvent.initValues[paramPin.id])}`;
        }

        return `value${index}`;
      })
      .join(",")}) => {
        ${code}
      };\n`;

    fxAssignmentCode += `${fxName},`;
  });

  return {
    fxDeclarationCode,
    fxAssignmentCode,
  };
};

interface HandleSlotContextConfig extends HandleSlotConfig {
  slotContexts: Set<string>;
}

export const handleSlotContext = (ui: UI, config: HandleSlotContextConfig) => {
  const slotRelativePathMap = config.getSlotRelativePathMap();
  const { slotContexts } = config;
  let importSlotContextCode = "";
  let useSlotContextCode = "";

  Array.from(slotContexts).forEach((slotContext) => {
    const slotRelativePath = slotRelativePathMap[slotContext];

    if (slotContext === "GlobalContext") {
      importSlotContextCode += `import { GlobalContext } from "${slotRelativePath}"`;
      useSlotContextCode += `const globalContext = useContext(GlobalContext);`;
      return;
    }

    const [comId, slotId] = slotContext.split("-");

    if (comId === ui.meta.comId && slotId === ui.meta.slotId) {
      return;
    }

    const importSlotContextName = slotId
      ? `SlotContext_${comId}_${slotId}`
      : "SlotContext";
    const useSlotContextName = slotId
      ? `slotContext_${comId}_${slotId}`
      : "slotContext";

    importSlotContextCode += `import { ${importSlotContextName} } from "${slotRelativePath}"`;
    useSlotContextCode += `const ${useSlotContextName} = useContext(${importSlotContextName});`;
  });

  return {
    importSlotContextCode,
    useSlotContextCode,
  };
};
