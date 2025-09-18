import {
  ImportManager,
  getName,
  convertHarmonyFlexComponent,
  getClassCode,
  getSlotComponentCode,
  indentation,
  getProviderCode,
  firstCharToUpperCase,
} from "./utils";
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
  const importManager = new ImportManager(config);
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
      depth: config.depth + 3, // [TODO 看情况的]
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
      depth: 2,
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
        uiCode += uiCode ? "\n\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      } else if (child.type === "module") {
        const ui = handleModule(child, nextConfig);
        uiCode += uiCode ? "\n\n" + ui : ui;
      } else {
        if (parent.props.style.width === "auto") {
          if (child.props.style.width === "100%") {
            child.props.style.width = "auto";
          }
        }
        const { ui, js, slots, scopeSlots } = handleDom(child, nextConfig);
        uiCode += uiCode ? "\n\n" + ui : ui;
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
      const indent = indentation(config.codeStyle!.indent);
      const indent2 = indentation(config.codeStyle!.indent * 2);
      if (effectEventCode) {
        effectEventCode = effectEventCode.replace(
          "aboutToAppear(): void {",
          `aboutToAppear(): void {` +
            `\n${indent2}this.${currentProvider.name}.params = this.params`,
        );
      } else {
        effectEventCode =
          `${indent}aboutToAppear(): void {` +
          `\n${indent2}this.${currentProvider.name}.params = this.params;` +
          `\n${indent}`;
      }
    }

    if (effectEventCode && effectEventCode.match("pageParams")) {
      importManager.addImport({
        packageName: config.getComponentPackageName(),
        dependencyNames: ["page"],
        importType: "named",
      });
      const indent2 = indentation(config.codeStyle!.indent * 2);
      effectEventCode = effectEventCode.replace(
        "aboutToAppear(): void {",
        `aboutToAppear(): void {` +
          `\n${indent2}/** 页面参数 */` +
          `\n${indent2}const pageParams: MyBricks.Any = page.getParams("${config.getCurrentScene().id}")`,
      );
    }

    if (vars) {
      const indent = indentation(config.codeStyle!.indent);
      if (effectEventCode) {
        effectEventCode = effectEventCode.replace(
          "aboutToAppear(): void {",
          `${vars.varsChangeCode}\n\n` +
            `aboutToAppear(): void {` +
            `\n${vars.varsRegisterChangeCode}`,
        );
      } else {
        effectEventCode =
          `${indent}aboutToAppear(): void {` +
          `${vars.varsRegisterChangeCode}\n${indent}}`;
      }

      effectEventCode +=
        `\n${indent}aboutToDisappear(): void {` +
        `\n${vars.varsUnRegisterChangeCode}` +
        `\n${indent}}`;
    }

    const indent = indentation(config.codeStyle!.indent * 2);

    return {
      js: (effectEventCode || "") + jsCode,
      ui: !props.style.layout
        ? `${indent}Column() {\n` + uiCode + `\n${indent}}`
        : convertHarmonyFlexComponent(props.style, {
            scope: true,
            child: uiCode,
            useExtraFlex: true,
            indentSize: config.codeStyle!.indent,
            initialIndent: config.codeStyle!.indent * 2,
          }),
      slots: level0Slots,
      scopeSlots: level1Slots,
      comIds,
      consumers,
      vars, // [TODO] vars fxs consumers应该在这一层处理完成，作为js返回
      fxs,
    };
  } else {
    const scene = config.getCurrentScene();
    const isModule = scene.type === "module";
    // 声明组件Controller
    const comIds = new Set<string>();
    // 调用上层组件
    const consumers = new Set<{ name: string; class: string }>();

    const addDependencyImport =
      config.addParentDependencyImport ||
      importManager.addImport.bind(importManager);
    const nextConfig = {
      ...config,
      depth: config.depth + (config.checkIsRoot() && isModule ? 4 : 3), // [TODO 看情况的]
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
        depth: 2,
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
          const indent = indentation(config.codeStyle!.indent * 2);
          const slotId = ui.meta.slotId;
          // 模块调用data，页面使用路由
          effectEventCode = effectEventCode.replace(
            "aboutToAppear(): void {",
            `aboutToAppear(): void {` +
              `\n${indent}/** 页面参数 */` +
              `\n${indent}const pageParams: MyBricks.Any = page.getParams("${config.getPageId?.(slotId) || slotId}")`,
          );
        }
      }

      if (vars) {
        const indent = indentation(config.codeStyle!.indent);
        if (effectEventCode) {
          effectEventCode = effectEventCode.replace(
            "aboutToAppear(): void {",
            `${vars.varsChangeCode}\n\n` +
              `aboutToAppear(): void {` +
              `\n${vars.varsRegisterChangeCode}`,
          );
        } else {
          effectEventCode =
            `${indent}aboutToAppear(): void {` +
            `${vars.varsRegisterChangeCode}\n${indent}}`;
        }

        effectEventCode +=
          `\n${indent}aboutToDisappear(): void {` +
          `\n${vars.varsUnRegisterChangeCode}` +
          `\n${indent}}`;
      }
    }

    const level0Slots: string[] = [];
    const level1Slots: string[] = [];

    children.forEach((child) => {
      if (child.type === "com") {
        const { ui, js, slots, scopeSlots } = handleCom(child, nextConfig);
        uiCode += uiCode ? "\n\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      } else if (child.type === "module") {
        const ui = handleModule(child, nextConfig);
        uiCode += uiCode ? "\n\n" + ui : ui;
      } else {
        if (parent.props.style.width === "auto") {
          if (child.props.style.width === "100%") {
            child.props.style.width = "auto";
          } else {
            child.props.style.width = "auto";
          }
        }
        const { ui, js, slots, scopeSlots } = handleDom(child, nextConfig);
        uiCode += uiCode ? "\n\n" + ui : ui;
        jsCode += js;
        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);
      }
    });

    if (config.checkIsRoot()) {
      // 非模块，由于页面默认都有一个root组件，所以直接简单地Column设置宽高100%铺满即可

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

        const indent2 = indentation(2);
        const indent4 = indentation(4);
        const indent6 = indentation(6);

        const todo =
          `${indent4}(this.controller.hide as MyBricks.Any).subscribe(() => {` +
          `\n${indent6}this.columnVisibilityController.visibility = Visibility.None` +
          `\n${indent4}});` +
          `\n${indent4}(this.controller.show as MyBricks.Any).subscribe(() => {` +
          `\n${indent6}this.columnVisibilityController.visibility = Visibility.Visible` +
          `\n${indent4}});` +
          `\n${indent4}(this.controller.showOrHide as MyBricks.Any).subscribe((value: MyBricks.EventValue) => {` +
          `\n${indent6}this.columnVisibilityController.visibility = !!value ? Visibility.Visible : Visibility.None` +
          `\n${indent4}});`;

        if (effectEventCode) {
          effectEventCode = effectEventCode.replace(
            "aboutToAppear(): void {",
            `@MyBricksDescriptor({\n` +
              `${indent4}provider: "${currentProvider.name}",\n` +
              `${indent2}})\n` +
              `${indent2}aboutToAppear(): void {` +
              `\n${todo}`,
          );
        } else {
          effectEventCode =
            `${indent2}@MyBricksDescriptor({\n` +
            `${indent4}provider: "${currentProvider.name}",\n` +
            `${indent2}})\n` +
            `${indent2}aboutToAppear(): void {\n` +
            todo +
            `\n${indent2}}`;
        }
      }

      let level0SlotsCode = level0Slots.join("\n\n");

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
        ? "/** 根组件变量 */\n" + vars.varsDeclarationCode + "\n"
        : "";
      const fxsDeclarationCode = fxs
        ? "/** 根组件Fx */\n" + fxs.fxsDeclarationCode + "\n"
        : "";

      const classCode = getClassCode({
        filterControllers,
        currentProvider,
        scene,
        config,
        title: "根组件控制器",
      });

      const providerCode = getProviderCode(
        {
          filterControllers,
          currentProvider,
          vars,
          fxs,
        },
        config,
      );

      const slotComponentCode = getSlotComponentCode(
        {
          scene,
          isModule,
          providerCode,
          effectEventCode,
          jsCode,
          level0SlotsCode,
          level1Slots,
          uiCode: isModule
            ? convertHarmonyFlexComponent(ui.props.style, {
                scope: false,
                child: uiCode,
                indentSize: config.codeStyle!.indent,
                initialIndent: config.codeStyle!.indent * 3,
              })
            : uiCode,
        },
        config,
      );

      config.add({
        importManager,
        content:
          (varsDeclarationCode ? `${varsDeclarationCode}\n` : "") +
          (fxsDeclarationCode ? `${fxsDeclarationCode}\n` : "") +
          (classCode ? `${classCode}\n` : "") +
          slotComponentCode,
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

    const indent = indentation(config.codeStyle!.indent * 3);

    return {
      js: jsCode,
      ui: !props.style.layout
        ? `${indent}Column() {\n` + uiCode + `\n${indent}}`
        : convertHarmonyFlexComponent(props.style, {
            scope: false,
            child: uiCode,
            useExtraFlex: true,
            indentSize: config.codeStyle!.indent,
            initialIndent: config.codeStyle!.indent * 3,
          }),
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

  const indent = indentation(config.codeStyle!.indent);

  return `${indent}aboutToAppear(): void {` + `\n${code}` + `\n${indent}}`;
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
  // 声明
  let varsDeclarationCode = "";
  let varsRegisterChangeCode = "";
  let varsUnRegisterChangeCode = "";
  let varsChangeCode = "";

  const indent = indentation(config.codeStyle!.indent);
  const indent2 = indentation(config.codeStyle!.indent * 2);

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

    if (varEvent.type === "var") {
      varsDeclarationCode += `${indent}${varEvent.title}: MyBricks.Controller = createVariable(${JSON.stringify(varEvent.meta.model.data.initValue)})\n`;
    }

    if (varEvent.type === "listener") {
      const providerMap = config.getProviderMap();
      const meta = varEvent.meta;
      const { parentComId, frameId } = meta;

      if (meta.global) {
        const packageName = config.getComponentPackageName(varEvent);
        if (packageName) {
          config.addParentDependencyImport({
            packageName,
            dependencyNames: ["globalVars"],
            importType: "named",
          });
        }
        const changeEventFunctionName = `globalVars${firstCharToUpperCase(varEvent.title)}Change`;
        varsRegisterChangeCode += `${indent2}globalVars.${varEvent.title}.registerChange(this.${changeEventFunctionName})\n`;
        varsUnRegisterChangeCode += `${indent2}globalVars.${varEvent.title}.unregisterChange(this.${changeEventFunctionName})\n`;
        varsChangeCode +=
          `\n${indent}${changeEventFunctionName} = (value: MyBricks.EventValue) => {` +
          `\n${code}` +
          `\n${indent}}`;
      } else {
        const providerName =
          config.getProviderName?.({
            com: meta,
            scene: config.getCurrentScene(),
          }) ||
          (!parentComId
            ? "slot_Index"
            : `slot_${frameId[0].toUpperCase() + frameId.slice(1)}_${parentComId}`);

        const provider = providerMap[providerName];

        config.addConsumer({
          ...provider,
          name: `${provider.name}_Vars`,
          class: `${provider.class}_Vars`,
        });
        const changeEventFunctionName = `${provider.name}_Vars${firstCharToUpperCase(varEvent.title)}Change`;
        varsRegisterChangeCode += `${indent2}this.${provider.name}_Vars.${varEvent.title}.registerChange(this.${changeEventFunctionName})\n`;
        varsUnRegisterChangeCode += `${indent2}this.${provider.name}_Vars.${varEvent.title}.unregisterChange(this.${changeEventFunctionName})\n`;
        varsChangeCode +=
          `\n${indent}${changeEventFunctionName} = (value: MyBricks.EventValue) => {` +
          `\n${code}` +
          `\n${indent}}`;
      }
    } else {
      const changeEventFunctionName = `${currentProvider.name}_Vars${firstCharToUpperCase(varEvent.title)}Change`;
      varsRegisterChangeCode += `${indent2}this.${currentProvider.name}_Vars.${varEvent.title}.registerChange(this.${changeEventFunctionName})\n`;
      varsUnRegisterChangeCode += `${indent2}this.${currentProvider.name}_Vars.${varEvent.title}.unregisterChange(this.${changeEventFunctionName})\n`;
      varsChangeCode +=
        `\n${indent}${changeEventFunctionName} = (value: MyBricks.EventValue) => {` +
        `\n${code}` +
        `\n${indent}}`;
    }
  });

  if (!varsChangeCode) {
    return null;
  }

  return {
    varsChangeCode,
    varsRegisterChangeCode,
    varsUnRegisterChangeCode,
    varsDeclarationCode: varsDeclarationCode
      ? `class ${currentProvider.class}_Vars {\n` + varsDeclarationCode + "}"
      : "",
    varsImplementCode: varsDeclarationCode
      ? `${indent}@Provider() ${currentProvider.name}_Vars: ${currentProvider.class}_Vars = new ${currentProvider.class}_Vars()`
      : "",
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

  const indent = indentation(config.codeStyle!.indent);
  const indent2 = indentation(config.codeStyle!.indent * 2);
  const indent3 = indentation(config.codeStyle!.indent * 3);
  const indent4 = indentation(config.codeStyle!.indent * 4);

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
      ? `${indent3}interface Return {\n` +
        `${fxEvent.frameOutputs
          .map((frameOutput: { title: string; id: string }) => {
            return (
              `${indent4}/** ${frameOutput.title} */` +
              `\n${indent4}${frameOutput.id}: MyBricks.EventValue`
            );
          })
          .join("\n")}\n${indent3}}`
      : "";

    fxsDeclarationCode +=
      `${indent}/** ${fxEvent.title} */\n` +
      `${indent}${fxEvent.frameId}: MyBricks.Api = createFx()\n`;

    fxsImplementCode +=
      `${indent2}/** ${fxEvent.title} */\n` +
      `${indent2}${fxEvent.frameId}: createFx((${values}) => {\n` +
      (returnInterface ? `${returnInterface}\n` : "") +
      `${code} ${returnInterface ? "as Return" : ""}\n` +
      `${indent2}}),\n`;
  });

  if (!fxsDeclarationCode) {
    return null;
  }

  return {
    fxsDeclarationCode:
      `class ${currentProvider.class}_Fxs {\n` + fxsDeclarationCode + "}",
    fxsImplementCode:
      `${indent}@Provider() ${currentProvider.name}_Fxs: ${currentProvider.class}_Fxs = {\n` +
      fxsImplementCode +
      `${indent}}`,
  };
};
