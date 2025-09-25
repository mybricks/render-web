/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  convertComponentStyle,
  ImportManager,
  firstCharToUpperCase,
  indentation,
  getBuilderCode,
  getUiComponentCode,
  getClassCode,
  getProviderCode,
  getSlotScopeComponentCode,
  genObjectCode,
  getPaddingCode,
} from "./utils";
import handleSlot from "./handleSlot";

import type { UI, BaseConfig } from "./index";

export type Com = Extract<UI["children"][0], { type: "com" }>;

type HandleComResult = {
  ui: string;
  js: string;
  slots: string[];
  scopeSlots: string[];
};

export interface HandleComConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
  addComId: (comId: string) => void;
}

const handleCom = (com: Com, config: HandleComConfig): HandleComResult => {
  const { meta, props, slots, events } = com;

  const isModule = meta.def.namespace.startsWith("mybricks.harmony.module");
  const { importInfo, callName } = config.getComponentMeta(meta);
  const componentName = callName;

  config.addParentDependencyImport({
    packageName: importInfo.from,
    dependencyNames: [importInfo.name],
    importType: importInfo.type,
  });

  let eventCode = "";
  let comEventCode = "";

  const paddingCode = getPaddingCode(
    convertComponentStyle(JSON.parse(JSON.stringify(props.style))),
    {
      initialIndent: config.codeStyle!.indent * config.depth,
      indentSize: config.codeStyle!.indent,
    },
  );

  Object.entries(events).forEach(([eventId, { type, diagramId }]) => {
    if (!diagramId) {
      // 没有添加事件
      return;
    }

    const event = config.getEventByDiagramId(diagramId)!;

    if (!event) {
      // 在引擎内新建了事件后删除，存在脏数据
      return;
    }
    if (type === "isAbstract") {
      config.setAbstractEventTypeDefMap({
        comId: com.meta.id,
        eventId,
        typeDef: config.getTypeDef(),
        schema: event.schema,
      });
      return;
    }
    if (type !== "defined") {
      // TODO: 后续支持直接调用fx
      return;
    }

    const defaultValue = "value";
    const indent = indentation(
      config.codeStyle!.indent * (config.depth + (paddingCode ? 3 : 2)),
    );

    let process = handleProcess(event, {
      ...config,
      depth: config.depth + (paddingCode ? 4 : 3),
      addParentDependencyImport: config.addParentDependencyImport,
      getParams: () => {
        return {
          [eventId]: defaultValue,
        };
      },
    });

    if (process.includes("pageParams")) {
      config.addParentDependencyImport({
        packageName: config.getComponentPackageName(),
        dependencyNames: ["page"],
        importType: "named",
      });
      process =
        indentation(
          config.codeStyle!.indent * (config.depth + (paddingCode ? 4 : 3)),
        ) +
        `const pageParams: MyBricks.Any = page.getParams("${config.getCurrentScene().id}");\n` +
        process;
    }

    comEventCode +=
      `${indent}${eventId}: (${defaultValue}: MyBricks.EventValue) => {\n` +
      process +
      `\n${indent}},\n`;
  });

  const currentProvider = config.getCurrentProvider();
  currentProvider.coms.add(meta.id);
  // 解决深浅色模式切换，数据重制等问题
  currentProvider.controllers.add(meta.id);

  if (slots) {
    // 当前组件的插槽
    let currentSlotsCode = "";
    // 同级插槽，非作用域下层
    const level0Slots: string[] = [];
    // 作用域插槽需声明为Component
    const level1Slots: string[] = [];

    Object.entries(slots).forEach(([slotId, slot], index) => {
      /**
       * 目前摸索到的规律
       * 1. 组件宽高是fit-content，Flex的宽高设置auto
       * 2. 组件定宽或者填充，Flex的宽高设置100%
       */
      if (com.props.style.width === "fit-content") {
        slot.props.style.width = "auto";
      } else {
        if (slot.props.style.layout !== "smart") {
          if (slot.props.style.layout === "flex-column") {
            if (com.meta.def.namespace === "mybricks.harmony.containerBasic") {
              if (
                com.props.style.width === "100%" ||
                typeof com.props.style.width === "number"
              ) {
                slot.props.style.width = "100%";
              } else {
                slot.props.style.width = "auto";
              }
            } else {
              if (com.props.style.width === "auto") {
                slot.props.style.width = "100%";
              } else {
                slot.props.style.width = "auto";
              }
            }
          } else {
            slot.props.style.width = "100%";
          }
        } else {
          // slot.props.style.width = "auto";
        }
      }

      if (com.props.style.height === "fit-content") {
        slot.props.style.height = "auto";
      } else {
        if (slot.props.style.layout !== "smart") {
          if (slot.props.style.layout === "flex-column") {
            if (com.meta.def.namespace === "mybricks.harmony.containerRow") {
              slot.props.style.height = "auto";
            } else {
              if (typeof com.props.style.height === "number") {
                if (
                  com.meta.def.namespace === "mybricks.harmony.containerBasic"
                ) {
                  slot.props.style.height = "100%";
                } else {
                  slot.props.style.height = "fit-content";
                }
              } else {
                slot.props.style.height = "auto";
              }
            }
          } else {
            slot.props.style.height = "100%";
          }
        } else {
          slot.props.style.height = "auto";
        }
      }

      if (!slot.meta.scope) {
        const { js, ui, slots, scopeSlots } = handleSlot(slot, {
          ...config,
          checkIsRoot: () => {
            return false;
          },
          depth: 1,
        });

        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);

        eventCode += js; // 非 scope 没有js

        const indent = indentation(config.codeStyle!.indent * 2);

        if (!index) {
          // 第一个 if
          currentSlotsCode =
            `${indent}if (params.id === "${slotId}") {\n` + ui + `\n${indent}}`;
        } else {
          // 其它的 else if
          currentSlotsCode +=
            ` else if (params.id === "${slotId}") {\n` + ui + `\n${indent}}`;
        }
      } else {
        const providerName =
          config.getProviderName?.({
            com: com.meta,
            slot: slot.meta,
            scene: config.getCurrentScene(),
          }) ||
          `slot_${slot.meta.slotId[0].toUpperCase() + slot.meta.slotId.slice(1)}_${slot.meta.comId}`;

        const currentProvider: ReturnType<BaseConfig["getCurrentProvider"]> = {
          name: providerName,
          class: providerName[0].toUpperCase() + providerName.slice(1),
          controllers: new Set(),
          useParams: false,
          useEvents: false,
          coms: new Set(),
          useController: false,
          useData: false,
        };
        const providerMap = config.getProviderMap();
        providerMap[currentProvider.name] = currentProvider;

        const { js, ui, slots, scopeSlots, consumers, vars, fxs } = handleSlot(
          slot,
          {
            ...config,
            checkIsRoot: () => {
              return false;
            },
            getCurrentProvider() {
              return currentProvider;
            },
            depth: 0,
          },
        );
        let uiCode = ui;

        currentProvider.coms.add(meta.id);

        level1Slots.push(...scopeSlots);

        const scene = config.getCurrentScene();
        const scopeSlotComponentName = firstCharToUpperCase(
          config.getComponentName?.({
            com: com.meta,
            slot: slot.meta,
            scene,
          }) || `${slotId}_${meta.id}`,
        );
        let slotsCode = slots.join("\n\n");

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
              slotsCode = slotsCode.replace(
                `controller: this.${currentProvider.name}.${componentController},\n`,
                "",
              );
              return false;
            }

            return true;
          },
        );

        const varsDeclarationCode = vars
          ? `/** ${meta.title}（${slot.meta.title}）组件变量 */\n` +
            vars.varsDeclarationCode +
            "\n"
          : "";
        const fxsDeclarationCode = fxs
          ? `/** ${meta.title}（${slot.meta.title}）组件Fx */\n` +
            fxs.fxsDeclarationCode +
            "\n"
          : "";

        const classCode = getClassCode({
          filterControllers,
          currentProvider,
          scene,
          config,
          title: `${meta.title}（${slot.meta.title}）组件控制器`,
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

        const slotScopeComponentCode = getSlotScopeComponentCode(
          {
            meta,
            slot,
            scopeSlotComponentName,
            consumers,
            providerCode,
            js,
            slotsCode,
            uiCode,
          },
          config,
        );

        level1Slots.push(
          "\n\n" +
            (varsDeclarationCode ? `${varsDeclarationCode}\n` : "") +
            (fxsDeclarationCode ? `${fxsDeclarationCode}\n` : "") +
            (classCode ? `${classCode}\n` : "") +
            slotScopeComponentCode,
        );

        const indent = indentation(config.codeStyle!.indent * 2);
        const indent2 = indentation(config.codeStyle!.indent * 3);

        if (!index) {
          // 第一个 if
          currentSlotsCode =
            `${indent}if (params.id === "${slotId}") {\n` +
            `${indent2}${scopeSlotComponentName}({ params })` +
            `\n${indent}}`;
        } else {
          // 其它的 else if
          currentSlotsCode +=
            ` else if (params.id === "${slotId}") {\n` +
            `${indent2}${scopeSlotComponentName}({ params })` +
            `\n${indent}}`;
        }
      }
    });

    const resultStyle = convertComponentStyle(props.style);
    const componentController =
      config.getComponentController?.({
        com: meta,
        scene: config.getCurrentScene(),
      }) || `controller_${meta.id}`;
    const slotsName = config.getComponentName
      ? `${config.getComponentName({ com: meta, scene: config.getCurrentScene() })}Slots`
      : `slots_${meta.id}`;

    const uiComponentCode = getUiComponentCode(
      {
        componentName,
        meta,
        currentProvider,
        componentController,
        props,
        resultStyle,
        slotsName,
        comEventCode,
      },
      config,
    );

    return {
      slots: [
        getBuilderCode(
          {
            meta,
            slotsName,
            currentSlotsCode,
          },
          config,
        ),
        ...level0Slots,
      ],
      scopeSlots: level1Slots,
      ui: uiComponentCode,
      js: eventCode,
    };
  } else {
    const resultStyle = convertComponentStyle(props.style);

    if (isModule) {
      // 模块组件特殊处理，同模块
      // [TODO] 合并下
      const resultStyle = convertComponentStyle(com.props.style);
      const componentController =
        config.getComponentController?.({
          com: meta,
          scene: config.getCurrentScene(),
        }) || `controller_${meta.id}`;

      const uiComponentCode = getUiComponentCode(
        {
          isModule,
          componentName,
          meta,
          currentProvider,
          componentController,
          props,
          resultStyle,
          comEventCode,
        },
        config,
      );

      return {
        ui: uiComponentCode,
        js: eventCode,
        slots: [],
        scopeSlots: [],
      };
    }

    const componentController =
      config.getComponentController?.({
        com: meta,
        scene: config.getCurrentScene(),
      }) || `controller_${meta.id}`;

    const uiComponentCode = getUiComponentCode(
      {
        componentName,
        meta,
        currentProvider,
        componentController,
        props,
        resultStyle,
        comEventCode,
      },
      config,
    );

    return {
      ui: uiComponentCode,
      js: eventCode,
      slots: [],
      scopeSlots: [],
    };
  }
};

export default handleCom;

interface HandleProcessConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  getParams: () => Record<string, string>;
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
}

export const handleProcess = (
  event: Exclude<ReturnType<BaseConfig["getEventByDiagramId"]>, undefined>,
  config: HandleProcessConfig,
) => {
  let code = "";
  const { process } = event;

  const indent = indentation(config.codeStyle!.indent * config.depth);
  const indent2 = indentation(config.codeStyle!.indent * (config.depth + 1));

  process.nodesDeclaration.forEach(({ meta, props }: any) => {
    if (meta.def.namespace.startsWith("mybricks.harmony.module")) {
      // 模块特殊处理
      return;
    }
    if (meta.def.namespace === "mybricks.core-comlib.bus-getUser") {
      return;
    }

    const { importInfo, name, callName } = config.getComponentMeta(meta);
    const componentName = name;

    config.addParentDependencyImport({
      packageName: importInfo.from,
      dependencyNames: [importInfo.name],
      importType: importInfo.type,
    });

    const componentNameWithId =
      config.getEventNodeName?.({
        com: meta,
        scene: config.getCurrentScene(),
        type: "declaration",
        event,
      }) || `${componentName}_${meta.id}`;

    code +=
      `${indent}/** ${meta.title} */` +
      `\n${indent}const ${componentNameWithId} = ${callName || componentName}({` +
      (config.verbose ? `\n${indent2}title: "${meta.title}",` : "") +
      (props.data
        ? `\n${indent2}data: ${genObjectCode(props.data, {
            initialIndent: config.codeStyle!.indent * (config.depth + 1),
            indentSize: config.codeStyle!.indent,
          })},`
        : "") +
      (props.inputs
        ? `\n${indent2}inputs: [${props.inputs.map((input: string) => `"${input}"`).join(", ")}],`
        : "") +
      (props.outputs
        ? `\n${indent2}outputs: [${props.outputs.map((output: string) => `"${output}"`).join(", ")}],`
        : "") +
      `\n${indent}})\n`;
  });

  process.nodesInvocation.forEach((props: any) => {
    const { componentType, category, runType } = props;
    // 参数
    let nextValue = getNextValue(props, config, event);

    const isSameScope = checkIsSameScope(event, props);
    // 节点执行后的返回值（输出）
    const nextCode = getNextCode(props, config, isSameScope, event);

    if (code) {
      // 换行
      code += "\n";
    }

    if (componentType === "js") {
      // 如何执行 js要区分自执行还是调用输入
      if (category === "scene") {
        // 导入页面路由模块
        config.addParentDependencyImport({
          packageName: config.getComponentPackageName(),
          dependencyNames: ["page"],
          importType: "named",
        });

        const _sceneId = props.meta.model.data._sceneId;

        const operateName =
          props.meta.model.data.openType === "redirect" ? "replace" : "open";

        code +=
          `${indent}/** 打开 ${props.meta.title} */` +
          `\n${indent}${nextCode}page.${operateName}("${config.getPageId?.(_sceneId) || _sceneId}", ${nextValue})`;
      } else if (category === "normal") {
        let componentNameWithId = getComponentNameWithId(props, config, event);
        if (props.meta.def?.namespace.startsWith("mybricks.harmony.module")) {
          const { importInfo, callName } = config.getComponentMeta(props.meta);
          const componentName = callName;

          config.addParentDependencyImport({
            packageName: importInfo.from,
            dependencyNames: [importInfo.name],
            importType: importInfo.type,
          });

          const api =
            config.getApi?.(props.meta.def.namespace).title || props.meta.title;

          componentNameWithId = `${componentName}.${api}`;
        }
        code +=
          `${indent}/** 调用 ${props.meta.title} */` +
          `\n${indent}${nextCode}${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
      } else if (category === "frameOutput") {
        // [TODO] 目前是区块调用输出
        const scene = config.getCurrentScene();
        const pinProxy = scene.pinProxies[`${props.meta.id}-${props.id}`];

        if (pinProxy.frameId === scene.id) {
          if (scene.type === "module") {
            if (props.meta.parentComId) {
              // 说明是作用域插槽里调用
              // 模块输出，直接取顶层
              const providerName =
                config.getProviderName?.({
                  scene,
                }) || "slot_Index";
              const provider = config.getProviderMap()[providerName];

              provider.useEvents = true;
              config.addConsumer(provider);
              code +=
                `${indent}/** 调用 ${props.meta.title} */` +
                `\n${indent}this.${provider.name}.events.${pinProxy.pinId}?.(${nextValue})`;
            } else {
              code +=
                `${indent}/** 调用 ${props.meta.title} */` +
                `\n${indent}this.events.${pinProxy.pinId}?.(${nextValue})`;
            }
          } else if (scene.type === "popup") {
            const pinProxy = scene.pinProxies[`${props.meta.id}-${props.id}`];
            const id = pinProxy.frameId;
            code +=
              `${indent}/** 调用页面输出 ${props.meta.title} */` +
              `\n${indent}page.${pinProxy.pinId}("${config.getPageId?.(id) || id}", ${nextValue})`;
          } else {
            console.log("[frameOutput 待处理场景]");
          }
        } else {
          console.log("[frameOutput 非当前场景]");
        }
      } else if (category === "var") {
        if (props.meta.global) {
          const packageName = config.getComponentPackageName(props);

          if (packageName) {
            config.addParentDependencyImport({
              packageName,
              dependencyNames: ["globalVars"],
              importType: "named",
            });
          }

          if (props.runType === "auto") {
            // 变量自执行特殊处理
            code +=
              `${indent}/** ${props.title} 全局变量 ${props.meta.title} */` +
              `\n${indent}${nextCode}globalVars.${props.meta.title}.changed()`;
          } else {
            code +=
              `${indent}/** ${props.title} 全局变量 ${props.meta.title} */` +
              `\n${indent}${nextCode}globalVars.${props.meta.title}.${props.id}(${nextValue})`;
          }
        } else {
          const currentProvider = getCurrentProvider(
            { isSameScope, props },
            config,
          );

          code +=
            `${indent}/** ${props.title} 变量 ${props.meta.title} */` +
            `\n${indent}${nextCode}this.${currentProvider.name}_Vars.${props.meta.title}.${props.id}(${nextValue})`;
        }
      } else if (category === "fx") {
        if (props.meta.global) {
          config.addParentDependencyImport({
            packageName: config.getComponentPackageName(),
            dependencyNames: ["globalFxs"],
            importType: "named",
          });
          code +=
            `${indent}/** 调用全局Fx ${props.meta.title} */` +
            `\n${indent}${nextCode}globalFxs.${props.meta.ioProxy.id}(${nextValue})`;
        } else {
          const currentProvider = getCurrentProvider(
            { isSameScope, props },
            config,
          );

          code +=
            `${indent}/** 调用Fx ${props.meta.title} */` +
            `\n${indent}${nextCode}this.${currentProvider.name}_Fxs.${props.meta.ioProxy.id}(${nextValue})`;
        }
      } else if (category === "bus") {
        const componentNameWithId = getComponentNameWithId(
          props,
          config,
          event,
        );

        code +=
          `${indent}/** 调用 ${props.meta.title} */` +
          `\n${indent}${nextCode}${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
      } else if (category === "frameInput") {
        const scene = config.getCurrentScene();
        const pinValueProxy =
          scene.pinValueProxies[`${props.meta.id}-${props.id}`];
        // const params = config.getParams();
        const { frameKey } = props;
        if (frameKey === "_rootFrame_") {
          // 场景输入

          if (scene.type === "module") {
            const title = `${indent}/** 调用获取当前输入值 ${props.title} */`;
            const input = scene.inputs.find(
              (input) => input.id === pinValueProxy.pinId,
            );
            const joinNext = `${input?.type === "config" ? "data" : "controller"}.${pinValueProxy.pinId}`;

            if (props.meta.parentComId) {
              const rootProvider = config.getRootProvider();
              config.addConsumer(rootProvider);

              if (input?.type === "config") {
                rootProvider.useData = true;
              } else {
                rootProvider.useController = true;
              }

              code +=
                title +
                `\n${indent}${nextCode}join(${nextValue}, this.${rootProvider.name}.${joinNext})`;
            } else {
              code +=
                title +
                `\n${indent}${nextCode}join(${nextValue}, this.${joinNext})`;
            }
          } else {
            code +=
              `${indent}/** 调用获取当前输入值 ${props.title} */` +
              `\n${indent}${nextCode}join(${nextValue}, pageParams)`;
          }
        } else {
          const [comId, slotId] = frameKey.split("-");

          if (comId === props.meta.parentComId) {
            // 同作用域
            code +=
              `${indent}/** 调用获取当前输入值 ${props.title} */` +
              `\n${indent}${nextCode}join(${nextValue}, this.params.inputValues.${pinValueProxy.pinId})`;
          } else {
            // 跨作用域
            const scopeSlotComponentName = `${slotId[0].toUpperCase() + slotId.slice(1)}_${comId}`;
            const providerMap = config.getProviderMap();
            const provider = providerMap[`slot_${scopeSlotComponentName}`];
            provider.useParams = true;

            config.addConsumer(provider);

            code +=
              `${indent}/** 调用获取当前输入值 ${props.title} */` +
              `\n${indent}${nextCode}join(${nextValue}, this.slot_${scopeSlotComponentName}.params.inputValues.${pinValueProxy.pinId})`;
          }
        }
      } else if (category === "event") {
        const scene = config.getCurrentScene();
        const pinProxy = scene.pinProxies[`${props.meta.id}-${props.id}`];
        const event = config.getExtensionEventById(pinProxy.frameId);
        const { dependencyImport, componentName } =
          config.getModuleApi("event");
        config.addParentDependencyImport(dependencyImport);

        code +=
          `${indent}/** 调用事件 ${event.title} */` +
          `\n${indent}${nextCode}${componentName}.${event.title}(${nextValue})`;
      } else {
        console.log("[出码] 其它类型js节点");
      }
    } else {
      if (category === "popup") {
        // popup类型的输出
        // [TODO] 后续观察是否需要判断props.type === frameOutput
        config.addParentDependencyImport({
          packageName: config.getComponentPackageName(),
          dependencyNames: ["page"],
          importType: "named",
        });
        const id = props.meta.id;
        code +=
          `${indent}/** 调用页面输出 ${props.title} */` +
          `\n${indent}page.${props.id}("${config.getPageId?.(id) || id}", ${nextValue})`;
        return;
      }

      if (props.type === "frameOutput") {
        if (props.category === "extension-api") {
          // extension-api卡片特殊处理
          code +=
            `${indent}/** 调用api回调 ${props.title} */` +
            `\n${indent}callBack.${props.id}(${nextValue})`;
          return;
        }

        if (props.category === "extension") {
          code +=
            `${indent}/** 调用api.emit ${props.title} */` +
            `\n${indent}this.emit("${props.id}", ${nextValue})`;
          return;
        }

        if (props.category === "module") {
          if (props.meta.parentComId) {
            // 说明是作用域插槽里调用
            // 模块输出，直接取顶层
            const providerName =
              config.getProviderName?.({
                scene: config.getCurrentScene(),
              }) || "slot_Index";
            const provider = config.getProviderMap()[providerName];
            provider.useEvents = true;
            config.addConsumer(provider);
            code +=
              `${indent}/** 调用 ${props.title} */` +
              `\n${indent}this.${provider.name}.events.${props.id}?.(${nextValue})`;
          } else {
            code +=
              `${indent}/** 调用 ${props.title} */` +
              `\n${indent}this.events.${props.id}?.(${nextValue})`;
          }
          return;
        }

        code +=
          `${indent}/** 调用插槽输出 ${props.title} */` +
          `\n${indent}this.params.outputs.${props.id}(${nextValue})`;
        return;
      }

      if (category === "module") {
        if (props.type === "frameRelOutput") {
          code += `${indent}this.controller.outputs.${props.id}(${nextValue})`;
          return;
        } else if (props.type === "exe") {
          const currentProvider = getCurrentProvider(
            { isSameScope, props },
            config,
          );
          currentProvider.controllers.add(props.meta.id);

          const componentController =
            config.getComponentController?.({
              com: props.meta,
              scene: config.getCurrentScene(),
            }) || `controller_${props.meta.id}`;

          code += `${indent}${nextCode}this.${currentProvider.name}.${componentController}.${props.id}(${nextValue})`;
          return;
        }
      }
      // ui
      const currentProvider = getCurrentProvider(
        { isSameScope, props },
        config,
      );
      currentProvider.controllers.add(props.meta.id);
      const componentController =
        config.getComponentController?.({
          com: props.meta,
          scene: config.getCurrentScene(),
        }) || `controller_${props.meta.id}`;

      let inputId = props.id;
      if (inputId === "_config_") {
        const { configBindWith } = props;
        if (configBindWith?.bindWith.startsWith("style:")) {
          inputId = "_setStyle";
          nextValue = `${JSON.stringify(configBindWith.bindWith.replace("style:", ""))}, ${nextValue}${configBindWith.xpath.split("/").join("?.")}`;
        } else if (configBindWith?.bindWith.startsWith("data.")) {
          inputId = "_setData";
          nextValue = `${JSON.stringify(configBindWith.bindWith.slice(5))}, ${nextValue}${configBindWith.xpath.split("/").join("?.")}`;
        } else {
          console.log("[出码] 其它ui配置类型");
        }
      }

      code +=
        `${indent}/** 调用 ${props.meta.title} 的 ${props.title} */` +
        `\n${indent}${nextCode}this.${currentProvider.name}.${componentController}.${inputId}(${nextValue})`;
    }
  });
  if (["fx", "extension-api", "extension-bus"].includes(event.type)) {
    const indent3 = indentation(config.codeStyle!.indent * (config.depth + 2));
    const returnCode = Object.entries(event.frameOutputs).reduce(
      (pre, [, { id, outputs }]: any) => {
        if (!outputs) {
          return pre + `${indent2}${id}: undefined,\n`;
        } else {
          const wrap = outputs.length > 1;
          const next = `${outputs
            .map((output: any) => {
              return `${wrap ? `\n${indent3}` : ""}${getNextValueWithParam(output, config, event)}`;
            })
            .join(", ")}`;

          if (wrap) {
            return pre + `${indent2}${id}: merge(` + next + `\n${indent2})\n`;
          }

          return pre + `${indent2}${id}: ${next},\n`;
        }
      },
      "",
    );

    if (returnCode) {
      code += `\n${indent}return {\n${returnCode}${indent}}`;
    }
  }

  return code;
};

/** 判断是否当前作用域 */
const checkIsSameScope = (event: any, props: any) => {
  if (
    event.type === "com" &&
    event.meta.parentComId === props.meta.parentComId &&
    event.meta.frameId === props.meta.frameId
  ) {
    // 当前作用域
    return true;
  } else if (
    event.type === "slot" &&
    event.comId === props.meta.parentComId &&
    event.slotId === props.meta.frameId
  ) {
    // 当前作用域
    return true;
  } else if (
    event.type === "fx" &&
    event.parentComId === props.meta.parentComId &&
    event.parentSlotId === props.meta.frameId
  ) {
    return true;
  } else if (
    event.type === "var" &&
    event.meta.parentComId === props.meta.parentComId &&
    event.meta.frameId === props.meta.frameId
  ) {
    return true;
  } else if (
    event.type === "listener" &&
    event.meta.proxy.parentComId === props.meta.parentComId &&
    event.meta.proxy.frameId === props.meta.frameId
  ) {
    return true;
  }

  return false;
};

const getComponentNameWithId = (
  props: any,
  config: HandleProcessConfig,
  event: any,
) => {
  const { componentType, category, meta, moduleId, type } = props;
  if (componentType === "js") {
    if (props.meta.def.namespace === "mybricks.core-comlib.scenes") {
      // 场景打开特殊处理，运行时内置实现
      return `page_${meta.id}`;
    } else if (
      props.meta.def.namespace === "mybricks.core-comlib.frame-output"
    ) {
      // frame输出特殊处理，运行时内置实现
      return `api_${meta.id}`;
    } else if (category === "var") {
      if (meta.global) {
        return `globalVars_${meta.title}`;
      }

      return `vars_${meta.title}`;
    } else if (category === "fx") {
      if (meta.global) {
        return `globalFxs_${meta.ioProxy.id}_${meta.id}`;
      }
      return `fxs_${meta.ioProxy.id}_${meta.id}`;
    } else if (category === "bus") {
      return `bus.${config.getBus!(props.meta.def.namespace).name}`;
    } else if (category === "frameInput") {
      return `frameInput_${meta.id}`;
    } else if (category === "event") {
      return `event_${meta.id}`;
    }
  } else if (componentType === "ui") {
    if (category === "module") {
      if (type === "frameOutput") {
        return `props.${props.id}`;
      } else if (type === "frameRelOutput") {
        return `ref.current.outputs.${props.id}`;
      }
      return `Module_${moduleId}_${meta.id}`;
    }
    if (config.getEventNodeName) {
      const componentName = config.getEventNodeName({
        com: props.meta,
        scene: config.getCurrentScene(),
        event,
        type: "call",
      });

      if (componentName) {
        return componentName;
      }
    }
  }

  if (config.getEventNodeName) {
    const componentName = config.getEventNodeName({
      com: props.meta,
      scene: config.getCurrentScene(),
      event,
      type: "declaration",
    });

    if (componentName) {
      return componentName;
    }
  }

  const { name } = config.getComponentMeta(props.meta);

  return `${name}_${meta.id}`;
};

const getNextCode = (
  props: any,
  config: HandleProcessConfig,
  isSameScope: boolean,
  event: any,
) => {
  // 节点执行后的返回值（输出）
  const { nextParam, componentType, category } = props;
  if (!nextParam.length) {
    return "";
  }

  if (componentType === "js") {
    const componentNameWithId = getComponentNameWithId(props, config, event);
    if (category === "var") {
      return `const ${componentNameWithId}_${nextParam[0].connectId} = `;
    } else if (category === "bus") {
      return `const bus_${props.meta.id} = `;
    } else if (category === "scene") {
      // [TODO] harmony-render-utils里想办法解决类型问题
      return `const ${componentNameWithId}_result: MyBricks.EventValue = `;
    } else if (category === "frameInput") {
      return `const ${componentNameWithId}_result: MyBricks.EventValue = `;
    }

    const next =
      config.getEventNodeName?.({
        com: props.meta,
        scene: config.getCurrentScene(),
        event,
        type: "call",
      }) || `${componentNameWithId}_result`;

    return `const ${next} = `;
  }

  // ui
  getCurrentProvider({ isSameScope, props }, config);

  if (!nextParam.length) {
    return "";
  }

  const nextComponentName =
    config.getEventNodeName?.({
      com: props.meta,
      scene: config.getCurrentScene(),
      event,
      connectId: nextParam[0].connectId,
      type: "call", // UI一定是call
    }) || `${props.meta.id}_${nextParam[0].id}_${nextParam[0].connectId}`;

  return `const ${nextComponentName} = `;
};

const getNextValue = (props: any, config: HandleProcessConfig, event: any) => {
  const { paramSource } = props;
  const nextValue = paramSource.map((param: any) => {
    if (param.type === "params") {
      const params = config.getParams();
      return params[param.id];
    } else if (param.type === "constant") {
      // 常量
      return JSON.stringify(param.value);
    }
    // [TODO] 这里要判断类型的
    const { id, connectId, category, componentType } = param;
    const componentNameWithId = getComponentNameWithId(param, config, event);
    if (connectId) {
      if (componentType === "js" && category === "var") {
        return `${componentNameWithId}_${connectId}`;
      }
      const next =
        config.getEventNodeName?.({
          com: param.meta,
          scene: config.getCurrentScene(),
          event,
          connectId,
          type: "call",
        }) || `${param.meta.id}_${param.id}_${param.connectId}`;
      // ui
      return `${next}.${param.id}`;
    }
    if (param.category === "frameOutput") {
      return `${componentNameWithId}_result`;
    } else if (param.category === "bus") {
      return `bus_${param.meta.id}.${id}`;
    } else if (param.category === "frameInput") {
      return `${componentNameWithId}_result`;
    }

    const next =
      config.getEventNodeName?.({
        com: param.meta,
        scene: config.getCurrentScene(),
        event,
        type: "call",
      }) || `${componentNameWithId}_result`;
    return `${next}.${id}`;
  });

  return nextValue.join(", ");
};

const getNextValueWithParam = (
  param: any,
  config: HandleProcessConfig,
  event: any,
) => {
  if (param.type === "params") {
    const params = config.getParams();
    return params[param.id];
  }
  // [TODO] 这里要判断类型的
  const { id, connectId, category, componentType } = param;
  if (category === "bus") {
    return `bus_${param.meta.id}.${param.id}`;
  }
  const componentNameWithId = getComponentNameWithId(param, config, event);
  if (connectId) {
    if (componentType === "js" && category === "var") {
      return `${componentNameWithId}_${connectId}`;
    }
    const next =
      config.getEventNodeName?.({
        com: param.meta,
        scene: config.getCurrentScene(),
        event,
        connectId,
        type: "call",
      }) || `${param.meta.id}_${param.id}_${param.connectId}`;
    // ui
    return `${next}.${param.id}`;
  }
  return `${componentNameWithId}_result.${id}`;
};

const getCurrentProvider = (
  params: {
    isSameScope: boolean;
    props: any;
  },
  config: HandleProcessConfig,
) => {
  const providerMap = config.getProviderMap();
  const { isSameScope, props } = params;
  const { category, meta } = props;
  const { parentComId, frameId } = meta;

  const providerName =
    config.getProviderName?.({ com: meta, scene: config.getCurrentScene() }) ||
    (!parentComId
      ? "slot_Index"
      : `slot_${frameId[0].toUpperCase() + frameId.slice(1)}_${parentComId}`);

  const provider = providerMap[providerName];

  if (!isSameScope) {
    if (category === "var") {
      // 变量
      config.addConsumer({
        ...provider,
        class: provider.class + "_Vars",
        name: provider.name + "_Vars",
      });
    } else if (category === "fx") {
      // Fx
      config.addConsumer({
        ...provider,
        class: provider.class + "_Fxs",
        name: provider.name + "_Fxs",
      });
    } else {
      config.addConsumer(provider);
    }
  }

  return provider;
};
