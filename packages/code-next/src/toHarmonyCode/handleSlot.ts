import {
  createDependencyImportCollector,
  generateImportDependenciesCode,
} from "./utils";
import handleCom, { handleProcess } from "./handleCom";
// import handleDom from "./handleDom";
// import handleModule from "./handleModule";

import type { UI, BaseConfig } from "./index";
import type { PinAry } from "../toCode/types";

interface HandleSlotConfig extends BaseConfig {
  addParentDependencyImport?: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  // addRefName?: (refName: string) => void;
  addController?: (controller: string) => void;
  addSlotContext?: (slotContext: string) => void;
  checkIsRoot: () => boolean;
  getSlotRelativePathMap: () => Record<string, string>;
}

const handleSlot = (ui: UI, config: HandleSlotConfig) => {
  const [parentDependencyImport, addParentDependencyImport] =
    createDependencyImportCollector();
  const { props, children } = ui;

  let uiCode = "";
  let jsCode = "";

  if (ui.meta.scope) {
    return {
      ui: "",
      js: "",
      slots: [],
    };
  } else {
    // 声明组件Controller
    const controllers = new Set<string>();

    // 需要导入使用的slotContext，调用上层组件的ref
    const slotContexts = new Set<string>();
    const addDependencyImport =
      config.addParentDependencyImport || addParentDependencyImport;
    const nextConfig = {
      ...config,
      addController:
        config.addController ||
        ((controller: string) => {
          controllers.add(controller);
        }),
      addParentDependencyImport: addDependencyImport,
      addSlotContext: (slotContext: string) => {
        slotContexts.add(slotContext);
      },
    };

    const level0Slots: string[] = [];

    children.forEach((child) => {
      if (child.type === "com") {
        const { ui, js, slots } = handleCom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
      } else if (child.type === "module") {
        console.log("❌❌❌ slot Module");
        // const { ui, js } = handleModule(child, nextConfig);
        // uiCode += ui;
        // jsCode += js;
      } else {
        console.log("❌❌❌ slot Dom");
        // const { ui } = handleDom(child, nextConfig);
        // uiCode += ui;
      }
    });

    if (config.checkIsRoot()) {
      config.add({
        path: `${config.getPath()}.ets`, // [TODO] 之后可能有嵌套解构，待讨论
        content: `${generateImportDependenciesCode(parentDependencyImport)}

        @Entry
        @Component
        struct Index {
          ${Array.from(controllers).join("\n")}

          ${jsCode}

          ${level0Slots.join("\n")}

          build() {
            Column() {
              ${uiCode}
            }
            .width("100%")
            .height("100%")
          }
        }
        `,
      });
    }

    // 插槽，写样式，对齐hm，写入hm utils
    const { style } = props;
    const flexProps = {
      direction: "FlexDirection.Row",
      justifyContent: "FlexAlign.Start",
      alignItems: "ItemAlign.Start",
    };
    if (style.layout === "flex-column") {
      flexProps.direction = "FlexDirection.Column";
    }
    if (style.justifyContent === "flex-start") {
      flexProps.justifyContent = "FlexAlign.Start";
    }
    if (style.justifyContent === "center") {
      flexProps.justifyContent = "FlexAlign.Center";
    }
    if (style.alignItems === "flex-start") {
      flexProps.alignItems = "ItemAlign.Start";
    }
    if (style.alignItems === "center") {
      flexProps.alignItems = "ItemAlign.Center";
    }

    return {
      js: jsCode,
      ui: `Flex({
        direction: ${flexProps.direction},
        justifyContent: ${flexProps.justifyContent},
        alignItems: ${flexProps.alignItems},
      }) {
        ${uiCode}
      }
      .width("100%")
      .height("100%")`,
      slots: level0Slots,
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
      (pre: Record<string, string>, id: string, index: number) => {
        pre[id] = `value${index}`;
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
      .map((id: string, index: number) => {
        if (id in fxEvent.initValues) {
          return `value${index} = ${JSON.stringify(fxEvent.initValues[id])}`;
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
