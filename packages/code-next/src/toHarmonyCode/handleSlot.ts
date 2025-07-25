import { ImportManager, getHmUi, getName } from "./utils";
import handleCom, { handleProcess } from "./handleCom";
import handleDom from "./handleDom";
import handleModule from "./handleModule";

import type { UI, BaseConfig } from "./index";
import type { PinAry } from "../toCode/types";

interface HandleSlotConfig extends BaseConfig {
  addParentDependencyImport?: (typeof ImportManager)["prototype"]["addImport"];
  addController?: (controller: string) => void;
  checkIsRoot: () => boolean;
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

    const vars = handleVarsEvent(ui, {
      ...nextConfig,
      addParentDependencyImport: addDependencyImport,
      addConsumer: (provider: { name: string; class: string }) => {
        consumers.add(provider);
      },
    });
    const fxs = handleFxsEvent(ui, {
      ...nextConfig,
      addParentDependencyImport: addDependencyImport,
      addConsumer: (provider: { name: string; class: string }) => {
        consumers.add(provider);
      },
    });

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
        const ui = handleModule(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
      } else {
        const { ui, js, slots, scopeSlots } = handleDom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      }
    });

    // 主场景和作用域插槽会有生命周期事件
    const effectEventCode = handleEffectEvent(ui, {
      ...nextConfig,
      getParams: (paramPins) => {
        return paramPins.reduce((pre: Record<string, string>, { id }) => {
          pre[id] = `this.params.inputValues.${id}`;
          return pre;
        }, {});
      },
      addParentDependencyImport: addDependencyImport,
      addConsumer: (provider: { name: string; class: string }) => {
        consumers.add(provider);
      },
    });

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
        : getHmUi({
            style: props.style,
            children: uiCode,
            extraFlex: `wrap: this.params.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,
            space: {
              main: LengthMetrics.vp(this.params.style?.rowGap || 0),
              cross: LengthMetrics.vp(this.params.style?.columnGap || 0)
            }`,
          }),
      // ui: !props.style.layout
      //   ? `Column() {
      //   ${uiCode}
      // }`
      //   : `Flex({
      //   direction: ${hmStyle.direction},
      //   justifyContent: ${hmStyle.justifyContent},
      //   alignItems: ${hmStyle.alignItems},
      //   wrap: params.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,
      //   space: {
      //     main: LengthMetrics.vp(params.style?.rowGap || 0),
      //     cross: LengthMetrics.vp(params.style?.columnGap || 0)
      //   }
      // }) {
      //   ${uiCode}
      // }
      // .width(${typeof hmStyle.width === "number" ? hmStyle.width : `"${hmStyle.width}"`})
      // .height(${typeof hmStyle.height === "number" ? hmStyle.height : `"${hmStyle.height}"`})`,
      slots: level0Slots,
      scopeSlots: level1Slots,
      controllers,
      consumers,
      vars, // [TODO] vars fxs consumers应该在这一层处理完成，作为js返回
      fxs,
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

    let vars = null;
    let fxs = null;

    if (config.checkIsRoot()) {
      // 之类要提前，把变量id与provider进行绑定
      vars = handleVarsEvent(ui, {
        ...nextConfig,
        addParentDependencyImport: addDependencyImport,
        addConsumer: (provider: { name: string; class: string }) => {
          consumers.add(provider);
        },
      });
      fxs = handleFxsEvent(ui, {
        ...nextConfig,
        addParentDependencyImport: addDependencyImport,
        addConsumer: (provider: { name: string; class: string }) => {
          consumers.add(provider);
        },
      });
    }

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
        const ui = handleModule(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
      } else {
        const { ui, js, slots, scopeSlots } = handleDom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      }
    });

    if (config.checkIsRoot()) {
      const scene = config.getCurrentScene();
      // 非模块，由于页面默认都有一个root组件，所以直接简单地Column设置宽高100%铺满即可
      const isModule = scene.type === "module";

      if (isModule) {
        addDependencyImport({
          dependencyNames: ["ModuleController"],
          packageName: config.getUtilsPackageName(),
          importType: "named",
        });
      }

      // 主场景和作用域插槽会有生命周期事件
      let effectEventCode = handleEffectEvent(ui, {
        ...nextConfig,
        getParams: (paramPins) => {
          return paramPins.reduce((pre: Record<string, string>, paramPin) => {
            // 调用函数，说明使用了打开输入
            // 模块调用data，页面使用路由
            const { id, type } = paramPin;
            pre[id] = isModule
              ? type === "config"
                ? `this.data.${id}`
                : `this.controller.${id}`
              : "pageParams";
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
        if (!isModule) {
          const slotId = ui.meta.slotId;
          // 模块调用data，页面使用路由
          effectEventCode = effectEventCode.replace(
            "aboutToAppear(): void {",
            `aboutToAppear(): void {
            /** 页面参数 */
            const pageParams: MyBricks.Any = page.getParams("${config.getPageId?.(slotId) || slotId}")`,
          );
        }
      }

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

      const varsDeclarationCode = vars
        ? `/** 根组件变量 */
      ${vars.varsDeclarationCode}\n`
        : "";
      const fxsDeclarationCode = fxs
        ? `/** 根组件Fx */
      ${fxs.fxsDeclarationCode}\n`
        : "";
      const classCode = filterControllers.length
        ? `/** 根组件控制器 */
        class ${currentProvider.class} {
          ${filterControllers
            .map((controller) => {
              const com = scene.coms[controller];
              const ControllerCode =
                com.def.namespace === "mybricks.core-comlib.module" ||
                com.def.namespace.startsWith("mybricks.harmony.module.")
                  ? "ModuleController()"
                  : "Controller()";
              return `/** ${com.title} */\ncontroller_${com.id} = ${ControllerCode}`;
            })
            .join("\n")}
        }\n`
        : "";
      let providerCode = filterControllers.length
        ? `@Provider() ${currentProvider.name}: ${currentProvider.class} = new ${currentProvider.class}()\n`
        : "";
      if (vars) {
        providerCode += vars.varsImplementCode + "\n";
      }
      if (fxs) {
        providerCode += fxs.fxsImplementCode + "\n";
      }

      config.add({
        importManager,
        content: `${varsDeclarationCode}${fxsDeclarationCode}${classCode}/** ${scene.title} */
        @ComponentV2
        ${isModule ? "export default " : ""}struct Index {
          ${isModule ? "@Param @Require uid: string;" : ""}
          ${isModule && config.verbose ? "@Param @Require title: string;" : ""}
          ${isModule ? "@Param data: MyBricks.Data = {}" : ""}
          ${isModule ? "@Param controller: MyBricks.ModuleController = ModuleController()" : ""}
          ${providerCode}
          ${(effectEventCode ? effectEventCode + "\n\n" : "") + jsCode}
          ${level0SlotsCode}

          build() {
            ${
              isModule
                ? getHmUi({ style: ui.props.style, children: uiCode })
                : `Column() {
              ${uiCode}
            }
            .width("100%")
            .height("100%")`
            }
          }
        }

        ${level1Slots.join("\n")}
        `,
        name: getName(ui.meta.title),
      });
    }

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
        : getHmUi({
            style: props.style,
            children: uiCode,
            extraFlex: `wrap: params.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,
            space: {
              main: LengthMetrics.vp(params.style?.rowGap || 0),
              cross: LengthMetrics.vp(params.style?.columnGap || 0)
            }`,
          }),
      // ui: !props.style.layout
      //   ? `Column() {
      //     ${uiCode}
      //   }`
      //   : `Flex({
      //   direction: ${hmStyle.direction},
      //   justifyContent: ${hmStyle.justifyContent},
      //   alignItems: ${hmStyle.alignItems},
      //   wrap: params.style?.flexWrap === "wrap" ? FlexWrap.Wrap : FlexWrap.NoWrap,
      //   space: {
      //     main: LengthMetrics.vp(params.style?.rowGap || 0),
      //     cross: LengthMetrics.vp(params.style?.columnGap || 0)
      //   }
      // }) {
      //   ${uiCode}
      // }
      // .width(${typeof hmStyle.width === "number" ? hmStyle.width : `"${hmStyle.width}"`})
      // .height(${typeof hmStyle.height === "number" ? hmStyle.height : `"${hmStyle.height}"`})`,
      slots: level0Slots,
      scopeSlots: level1Slots,
      controllers,
      consumers,
    };
  }
};

export default handleSlot;

interface HandleEffectEventConfig extends HandleSlotConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
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

  // [TODO] 观察下什么情况下effectEvent是undefined
  const code =
    effectEvent &&
    handleProcess(effectEvent, {
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
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addConsumer: (provider: { name: string; class: string }) => void;
}

export const handleVarsEvent = (ui: UI, config: HandleVarsEventConfig) => {
  const isScope = ui.meta.scope;
  const currentProvider = config.getCurrentProvider();
  const providerMetaMap = config.getProviderMetaMap();
  const varEvents = config.getVarEvents(
    isScope
      ? {
          comId: ui.meta.comId!,
          slotId: ui.meta.slotId,
        }
      : undefined,
  );
  let varsDeclarationCode = "";
  let varsImplementCode = "";

  varEvents.forEach((varEvent) => {
    if (!providerMetaMap[varEvent.meta.id]) {
      providerMetaMap[varEvent.meta.id] = currentProvider;
    }

    config.addParentDependencyImport({
      packageName: config.getUtilsPackageName(),
      dependencyNames: ["createVariable"],
      importType: "named",
    });
    const code = handleProcess(varEvent, {
      ...config,
      getParams: () => {
        return {
          [varEvent.paramId]: "value",
        };
      },
    });

    varsDeclarationCode += `${varEvent.title}: MyBricks.Controller = createVariable()`;

    varsImplementCode += `${varEvent.title}: createVariable(${JSON.stringify(varEvent.meta.model.data.initValue)}, (value: MyBricks.EventValue) => {
      ${code}
    })`;
  });

  if (!varsDeclarationCode) {
    return null;
  }

  return {
    varsDeclarationCode: `class ${currentProvider.class}_Vars {
      ${varsDeclarationCode}
    }`,
    varsImplementCode: `@Provider() ${currentProvider.name}_Vars: ${currentProvider.class}_Vars = {
      ${varsImplementCode}
    }`,
  };
};

interface HandleFxsEventConfig extends HandleSlotConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addConsumer: (provider: { name: string; class: string }) => void;
}

export const handleFxsEvent = (ui: UI, config: HandleFxsEventConfig) => {
  const isScope = ui.meta.scope;
  const currentProvider = config.getCurrentProvider();
  const providerMetaMap = config.getProviderMetaMap();
  const fxEvents = config.getFxEvents(
    isScope
      ? {
          comId: ui.meta.comId!,
          slotId: ui.meta.slotId,
        }
      : undefined,
  );
  let fxsDeclarationCode = "";
  let fxsImplementCode = "";

  fxEvents.forEach((fxEvent) => {
    if (!providerMetaMap[fxEvent.frameId]) {
      providerMetaMap[fxEvent.frameId] = currentProvider;
    }

    config.addParentDependencyImport({
      packageName: config.getUtilsPackageName(),
      dependencyNames: ["createFx"],
      importType: "named",
    });

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

    /** 入参 */
    const values = fxEvent.paramPins
      .map((paramPin, index) => {
        if (paramPin.type === "config") {
          // 配置的默认值
          return `value${index}: MyBricks.EventValue = ${JSON.stringify(fxEvent.initValues[paramPin.id])}`;
        }

        return `value${index}: MyBricks.EventValue`;
      })
      .join(", ");

    /** 结果interface定义 */
    const returnInterface = fxEvent.frameOutputs.length
      ? `interface Return {
      ${fxEvent.frameOutputs
        .map((frameOutput: { title: string; id: string }) => {
          return `/** ${frameOutput.title} */
        ${frameOutput.id}: MyBricks.EventValue`;
        })
        .join("\n")}}`
      : "";

    fxsDeclarationCode += `/** ${fxEvent.title} */
    ${fxEvent.frameId}: MyBricks.Any = createFx()
    `;
    fxsImplementCode += `/** ${fxEvent.title} */
      ${fxEvent.frameId}: createFx((${values}) => {
        ${returnInterface}
        ${code} ${returnInterface ? "as Return" : ""}
      })
      `;
  });

  if (!fxsDeclarationCode) {
    return null;
  }

  return {
    fxsDeclarationCode: `class ${currentProvider.class}_Fxs {
      ${fxsDeclarationCode}
    }`,
    fxsImplementCode: `@Provider() ${currentProvider.name}_Fxs: ${currentProvider.class}_Fxs = {
      ${fxsImplementCode}
    }`,
  };
};
