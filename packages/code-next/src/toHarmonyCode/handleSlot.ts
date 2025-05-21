import {
  createDependencyImportCollector,
  convertHMFlexStyle,
  ImportManager,
} from "./utils";
import handleCom, { handleProcess } from "./handleCom";

import type { UI, BaseConfig } from "./index";
import type { PinAry } from "../toCode/types";

interface HandleSlotConfig extends BaseConfig {
  addParentDependencyImport?: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addController?: (controller: string) => void;
  checkIsRoot: () => boolean;
  getSlotRelativePathMap: () => Record<string, string>;
}

const handleSlot = (ui: UI, config: HandleSlotConfig) => {
  const importManager = new ImportManager();
  const { props, children } = ui;

  let uiCode = "";
  let jsCode = "";

  const providerMetaMap = config.getProviderMetaMap();
  const currentProvider = config.getCurrentProvider();

  if (ui.meta.scope) {
    const currentProvider = {
      name: `slot_${ui.meta.slotId[0].toUpperCase() + ui.meta.slotId.slice(1)}_${ui.meta.comId}`,
      class: `Slot_${ui.meta.slotId[0].toUpperCase() + ui.meta.slotId.slice(1)}_${ui.meta.comId}`,
    };

    // 声明组件Controller
    const controllers = new Set<string>();
    // 调用上层组件
    const consumers = new Set<{ name: string; class: string }>();

    const addDependencyImport =
      config.addParentDependencyImport ||
      importManager.addImport.bind(importManager);
    const nextConfig = {
      ...config,
      addController: (controller: string) => {
        controllers.add(controller);
      },
      addParentDependencyImport: addDependencyImport,
      addConsumer: (provider: { name: string; class: string }) => {
        consumers.add(provider);
      },
      getCurrentProvider: () => currentProvider,
    };

    const level0Slots: string[] = [];
    const level1Slots: string[] = [];

    children.forEach((child) => {
      if (child.type === "com") {
        if (!providerMetaMap[child.meta.id]) {
          providerMetaMap[child.meta.id] = currentProvider;
        }
        const { ui, js, slots, scopeSlots } = handleCom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      } else if (child.type === "module") {
        console.log("[TODO] slot Module");
      } else {
        console.log("[TODO] slot Dom");
      }
    });

    // 主场景和作用域插槽会有生命周期事件
    const effectEventCode = handleEffectEvent(ui, {
      ...nextConfig,
      getParams: (paramPins) => {
        return paramPins.reduce((pre: Record<string, string>, { id }) => {
          pre[id] = `this.inputValues.${id}`;
          return pre;
        }, {});
      },
      addParentDependencyImport: importManager.addImport.bind(importManager),
      addConsumer: (provider: { name: string; class: string }) => {
        consumers.add(provider);
      },
    });

    const hmStyle = convertHMFlexStyle(props.style);

    if (props.style.layout) {
      importManager.addImport({
        dependencyNames: ["LengthMetrics"],
        packageName: "@kit.ArkUI",
        importType: "named",
      });
    }

    return {
      js: (effectEventCode ? effectEventCode + "\n\n" : "") + jsCode,
      ui: !props.style.layout
        ? `Column() {
        ${uiCode}
      }`
        : `Flex({
        direction: ${hmStyle.direction},
        justifyContent: ${hmStyle.justifyContent},
        alignItems: ${hmStyle.alignItems},
        wrap: params.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,
        space: {
          main: LengthMetrics.vp(params.style?.rowGap || 0),
          cross: LengthMetrics.vp(params.style?.columnGap || 0)
        }
      }) {
        ${uiCode}
      }
      .width(${typeof hmStyle.width === "number" ? hmStyle.width : `"${hmStyle.width}"`})
      .height(${typeof hmStyle.height === "number" ? hmStyle.height : `"${hmStyle.height}"`})`,
      slots: level0Slots,
      scopeSlots: level1Slots,
      controllers,
      consumers,
    };
  } else {
    // 声明组件Controller
    const controllers = new Set<string>();
    // 调用上层组件
    const consumers = new Set<{ name: string; class: string }>();

    const addDependencyImport =
      config.addParentDependencyImport ||
      importManager.addImport.bind(importManager);
    const nextConfig = {
      ...config,
      addController:
        config.addController ||
        ((controller: string) => {
          controllers.add(controller);
        }),
      addParentDependencyImport: addDependencyImport,
      addConsumer: (provider: { name: string; class: string }) => {
        consumers.add(provider);
      },
    };

    const level0Slots: string[] = [];
    const level1Slots: string[] = [];

    children.forEach((child) => {
      if (child.type === "com") {
        if (!providerMetaMap[child.meta.id]) {
          providerMetaMap[child.meta.id] = currentProvider;
        }
        const { ui, js, slots, scopeSlots } = handleCom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      } else if (child.type === "module") {
        console.log("[TODO] slot Module");
      } else {
        console.log("[TODO] slot Dom");
      }
    });

    if (config.checkIsRoot()) {
      // 主场景和作用域插槽会有生命周期事件
      let effectEventCode = handleEffectEvent(ui, {
        ...nextConfig,
        getParams: (paramPins) => {
          return paramPins.reduce((pre: Record<string, string>, { id }) => {
            // 调用函数，说明使用了打开输入
            pre[id] = "pageParams";
            return pre;
          }, {});
        },
        addParentDependencyImport: importManager.addImport.bind(importManager),
        addConsumer: (provider: { name: string; class: string }) => {
          consumers.add(provider);
        },
      });

      if (effectEventCode && effectEventCode.match("pageParams")) {
        importManager.addImport({
          packageName: config.getComponentPackageName(),
          dependencyNames: ["page"],
          importType: "named",
        });
        effectEventCode = effectEventCode.replace(
          "aboutToAppear(): void {",
          `aboutToAppear(): void {
          const pageParams = page.getParams("${ui.meta.slotId}")`,
        );
      }

      const scene = config.getCurrentScene();
      const usedControllers = config.getUsedControllers();
      let level0SlotsCode = level0Slots.join("\n");
      const filterControllers = Array.from(controllers).filter((controller) => {
        if (!usedControllers.has(controller)) {
          uiCode = uiCode.replace(
            `controller: this.${currentProvider.name}.controller_${controller},\n`,
            "",
          );
          level0SlotsCode = level0SlotsCode.replace(
            `controller: this.${currentProvider.name}.controller_${controller},\n`,
            "",
          );
          return false;
        }
        return true;
      });

      const classCode = filterControllers.length
        ? `/** 根组件控制器 */
        class ${currentProvider.class} {
          ${filterControllers
            .map((controller) => {
              const com = scene.coms[controller];
              return `/** ${com.title} */\ncontroller_${com.id} = Controller()`;
            })
            .join("\n")}
        }\n`
        : "";
      const providerCode = filterControllers.length
        ? `@Provider() ${currentProvider.name}: ${currentProvider.class} = new ${currentProvider.class}()\n`
        : "";

      config.add({
        path: `${config.getPath()}.ets`, // [TODO] 之后可能有嵌套结构，待讨论
        importManager,
        content: `${classCode}/** ${scene.title} */
        @ComponentV2
        struct Index {
          ${providerCode}
          ${(effectEventCode ? effectEventCode + "\n\n" : "") + jsCode}
          ${level0SlotsCode}

          build() {
            Column() {
              ${uiCode}
            }
            .width("100%")
            .height("100%")
          }
        }

        ${level1Slots.join("\n")}
        `,
      });
    }

    const hmStyle = convertHMFlexStyle(props.style);

    if (props.style.layout) {
      addDependencyImport({
        dependencyNames: ["LengthMetrics"],
        packageName: "@kit.ArkUI",
        importType: "named",
      });
    }

    return {
      js: jsCode,
      ui: !props.style.layout
        ? `Column() {
          ${uiCode}
        }`
        : `Flex({
        direction: ${hmStyle.direction},
        justifyContent: ${hmStyle.justifyContent},
        alignItems: ${hmStyle.alignItems},
        wrap: params.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,
        space: {
          main: LengthMetrics.vp(params.style?.rowGap || 0),
          cross: LengthMetrics.vp(params.style?.columnGap || 0)
        }
      }) {
        ${uiCode}
      }
      .width(${typeof hmStyle.width === "number" ? hmStyle.width : `"${hmStyle.width}"`})
      .height(${typeof hmStyle.height === "number" ? hmStyle.height : `"${hmStyle.height}"`})`,
      slots: level0Slots,
      scopeSlots: level1Slots,
      controllers,
      consumers,
    };
  }
};

export default handleSlot;

interface HandleEffectEventConfig extends HandleSlotConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  getParams: (paramPins: PinAry) => Record<string, string>;
  addConsumer: (provider: { name: string; class: string }) => void;
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

  const code = handleProcess(effectEvent, {
    ...config,
    getParams: () => {
      return config.getParams(effectEvent.paramPins);
    },
  });

  if (!code) {
    return null;
  }

  return `aboutToAppear(): void {
    ${code}
  }`;
};

interface HandleVarsEventConfig extends HandleSlotConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addConsumer: (provider: { name: string; class: string }) => void;
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
  addConsumer: (provider: { name: string; class: string }) => void;
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
