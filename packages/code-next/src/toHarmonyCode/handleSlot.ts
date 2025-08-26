import { ImportManager, getName, convertHarmonyFlexComponent } from "./utils";
import handleCom, { handleProcess } from "./handleCom";
import handleDom from "./handleDom";
import handleModule from "./handleModule";

import type { UI, BaseConfig } from "./index";
import type { PinAry } from "../toCode/types";

interface HandleSlotConfig extends BaseConfig {
  addParentDependencyImport?: (typeof ImportManager)["prototype"]["addImport"];
  addComId?: (comId: string) => void;
  addConsumer?: (
    provider: ReturnType<BaseConfig["getCurrentProvider"]>,
  ) => void;
  checkIsRoot: () => boolean;
}

const handleSlot = (ui: UI, config: HandleSlotConfig) => {
  const importManager = new ImportManager();
  const { props, children } = ui;
  const parent = ui;

  let uiCode = "";
  let jsCode = "";

  const currentProvider = config.getCurrentProvider();

  if (ui.meta.scope) {
    // 声明组件Controller
    const comIds = new Set<string>();
    // 调用上层组件
    const consumers = new Set<{ name: string; class: string }>();

    const addDependencyImport =
      config.addParentDependencyImport ||
      importManager.addImport.bind(importManager);
    const nextConfig = {
      ...config,
      addComId: (comId: string) => {
        comIds.add(comId);
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
    // 主场景和作用域插槽会有生命周期事件
    let effectEventCode = handleEffectEvent(ui, {
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

    const level0Slots: string[] = [];
    const level1Slots: string[] = [];

    children.forEach((child) => {
      if (child.type === "com") {
        const { ui, js, slots, scopeSlots } = handleCom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      } else if (child.type === "module") {
        const ui = handleModule(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
      } else {
        if (parent.props.style.width === "auto") {
          if (child.props.style.width === "100%") {
            child.props.style.width = "auto";
          }
        }
        const { ui, js, slots, scopeSlots } = handleDom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      }
    });

    if (props.style.layout) {
      importManager.addImport({
        dependencyNames: ["LengthMetrics"],
        packageName: "@kit.ArkUI",
        importType: "named",
      });
    }

    if (currentProvider.useParams) {
      if (effectEventCode) {
        effectEventCode = effectEventCode.replace(
          "aboutToAppear(): void {",
          `aboutToAppear(): void {
            this.${currentProvider.name}.params = this.params;
          `,
        );
      } else {
        effectEventCode = `aboutToAppear(): void {
          this.${currentProvider.name}.params = this.params;
        }`;
      }
    }

    return {
      js: (effectEventCode ? effectEventCode + "\n\n" : "") + jsCode,
      ui: !props.style.layout
        ? `Column() {
        ${uiCode}
      }`
        : convertHarmonyFlexComponent(props.style, {
            child: uiCode,
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
      comIds,
      consumers,
      vars, // [TODO] vars fxs consumers应该在这一层处理完成，作为js返回
      fxs,
    };
  } else {
    // 声明组件Controller
    const comIds = new Set<string>();
    // 调用上层组件
    const consumers = new Set<{ name: string; class: string }>();

    const addDependencyImport =
      config.addParentDependencyImport ||
      importManager.addImport.bind(importManager);
    const nextConfig = {
      ...config,
      addComId:
        config.addComId ||
        ((comId: string) => {
          comIds.add(comId);
        }),
      addParentDependencyImport: addDependencyImport,
      addConsumer:
        config.addConsumer ||
        ((provider: ReturnType<BaseConfig["getCurrentProvider"]>) => {
          consumers.add(provider);
        }),
    };

    let vars = null;
    let fxs = null;

    // 主场景和作用域插槽会有生命周期事件
    let effectEventCode;

    if (config.checkIsRoot()) {
      // 之类要提前，把变量id与provider进行绑定
      vars = handleVarsEvent(ui, {
        ...nextConfig,
        addParentDependencyImport: addDependencyImport,
        addConsumer:
          config.addConsumer ||
          ((provider: ReturnType<BaseConfig["getCurrentProvider"]>) => {
            consumers.add(provider);
          }),
      });
      fxs = handleFxsEvent(ui, {
        ...nextConfig,
        addParentDependencyImport: addDependencyImport,
        addConsumer:
          config.addConsumer ||
          ((provider: ReturnType<BaseConfig["getCurrentProvider"]>) => {
            consumers.add(provider);
          }),
      });

      const scene = config.getCurrentScene();
      const isModule = scene.type === "module";

      effectEventCode = handleEffectEvent(ui, {
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
        addConsumer:
          config.addConsumer ||
          ((provider: ReturnType<BaseConfig["getCurrentProvider"]>) => {
            consumers.add(provider);
          }),
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
    }

    const level0Slots: string[] = [];
    const level1Slots: string[] = [];

    children.forEach((child) => {
      if (child.type === "com") {
        const { ui, js, slots, scopeSlots } = handleCom(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      } else if (child.type === "module") {
        const ui = handleModule(child, nextConfig);
        uiCode += uiCode ? "\n" + ui : ui;
      } else {
        if (parent.props.style.width === "auto") {
          if (child.props.style.width === "100%") {
            child.props.style.width = "auto";
          } else {
            child.props.style.width = "auto";
          }
        }
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

        addDependencyImport({
          dependencyNames: ["MyBricksDescriptor"],
          packageName: config.getUtilsPackageName(),
          importType: "named",
        });

        if (effectEventCode) {
          effectEventCode = effectEventCode.replace(
            "aboutToAppear(): void {",
            `@MyBricksDescriptor({
              provider: "${currentProvider.name}",
            })
            aboutToAppear(): void {`,
          );
        } else {
          effectEventCode = `@MyBricksDescriptor({
            provider: "${currentProvider.name}",
          })
          aboutToAppear(): void {}`;
        }
      }

      // const usedControllers = config.getUsedControllers();
      let level0SlotsCode = level0Slots.join("\n");

      const filterControllers = Array.from(currentProvider.coms).filter(
        (controller) => {
          if (!currentProvider.controllers.has(controller)) {
            const com = scene.coms[controller];
            const componentController =
              config.getComponentController?.({ com, scene }) ||
              `controller_${controller}`;
            uiCode = uiCode.replace(
              `controller: this.${currentProvider.name}.${componentController},\n`,
              "",
            );
            level0SlotsCode = level0SlotsCode.replace(
              `controller: this.${currentProvider.name}.${componentController},\n`,
              "",
            );
            return false;
          }

          return true;
        },
      );

      const varsDeclarationCode = vars
        ? `/** 根组件变量 */
      ${vars.varsDeclarationCode}\n`
        : "";
      const fxsDeclarationCode = fxs
        ? `/** 根组件Fx */
      ${fxs.fxsDeclarationCode}\n`
        : "";
      const classCode =
        filterControllers.length ||
        currentProvider.useParams ||
        currentProvider.useEvents
          ? `/** 根组件控制器 */
        class ${currentProvider.class} {
          ${currentProvider.useParams ? "/** 插槽参数 */\nparams: MyBricks.Any" : ""}
          ${currentProvider.useEvents ? "/** 事件 */\nevents: MyBricks.Events = {}" : ""}
          ${filterControllers
            .map((controller) => {
              const com = scene.coms[controller];
              const componentController =
                config.getComponentController?.({ com, scene }) ||
                `controller_${com.id}`;
              const ControllerCode =
                com.def.namespace === "mybricks.core-comlib.module" ||
                com.def.namespace.startsWith("mybricks.harmony.module.")
                  ? "ModuleController()"
                  : "Controller()";
              return `/** ${com.title} */\n${componentController} = ${ControllerCode}`;
            })
            .join("\n")}
        }\n`
          : "";
      let providerCode =
        filterControllers.length ||
        currentProvider.useParams ||
        currentProvider.useEvents
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
          ${isModule ? '@Param uid: string = ""' : ""}
          ${isModule && config.verbose ? `@Param title: string = "${scene.title}"` : ""}
          ${isModule ? "@Param data: MyBricks.Data = {}" : ""}
          ${isModule ? "@Param controller: MyBricks.ModuleController = ModuleController()" : ""}
          ${isModule ? "@Param styles: Styles = {}" : ""}
          ${isModule ? "@Param events: MyBricks.Events = {}" : ""}
          ${isModule ? "@Local columnVisibilityController: ColumnVisibilityController = new ColumnVisibilityController()" : ""}
          ${providerCode}
          ${isModule ? "myBricksColumnModifier = new MyBricksColumnModifier(this.styles.root)" : ""}
          ${(effectEventCode ? effectEventCode + "\n\n" : "") + jsCode}
          ${level0SlotsCode}

          build() {
            ${
              isModule
                ? `Column() {
                  ${convertHarmonyFlexComponent(ui.props.style, { child: uiCode })}
                }
                .attributeModifier(this.myBricksColumnModifier)
                .visibility(this.columnVisibilityController.visibility)`
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
        name: config.getFileName?.(ui.meta.slotId) || getName(ui.meta.title),
      });
    }

    if (props.style.layout) {
      addDependencyImport({
        dependencyNames: ["LengthMetrics"],
        packageName: "@kit.ArkUI",
        importType: "named",
      });
    }

    if (config.checkIsRoot()) {
      const scene = config.getCurrentScene();
      Array.from(currentProvider.coms).filter((controller) => {
        if (!currentProvider.controllers.has(controller)) {
          const com = scene.coms[controller];
          const componentController =
            config.getComponentController?.({ com, scene }) ||
            `controller_${controller}`;
          uiCode = uiCode.replace(
            `controller: this.${currentProvider.name}.${componentController},\n`,
            "",
          );
          return false;
        }

        return true;
      });
    }

    if (props.style.layout) {
      if (ui.children.find((child) => child.props.style.flex)) {
        // 有flex，说明是填充。
        if (props.style.layout === "flex-column") {
          props.style.height = "100%";
        } else if (props.style.layout === "flex-row") {
          props.style.width = "100%";
        }
      }
    }

    return {
      js: jsCode,
      ui: !props.style.layout
        ? `Column() {
        ${uiCode}
      }`
        : convertHarmonyFlexComponent(props.style, {
            child: uiCode,
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
      comIds,
      consumers,
    };
  }
};

export default handleSlot;

interface HandleEffectEventConfig extends HandleSlotConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  getParams: (paramPins: PinAry) => Record<string, string>;
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
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
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
}

export const handleVarsEvent = (ui: UI, config: HandleVarsEventConfig) => {
  const isScope = ui.meta.scope;
  const currentProvider = config.getCurrentProvider();
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

    varsDeclarationCode += `${varEvent.title}: MyBricks.Controller = createVariable()\n`;

    varsImplementCode += `${varEvent.title}: createVariable(${JSON.stringify(varEvent.meta.model.data.initValue)}, (value: MyBricks.EventValue) => {
      ${code}
    }),\n`;
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
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
}

export const handleFxsEvent = (ui: UI, config: HandleFxsEventConfig) => {
  const isScope = ui.meta.scope;
  const currentProvider = config.getCurrentProvider();
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

    if (code.includes("merge(")) {
      config.addParentDependencyImport({
        packageName: config.getUtilsPackageName(),
        dependencyNames: ["merge"],
        importType: "named",
      });
    }

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
    ${fxEvent.frameId}: MyBricks.Api = createFx()
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
