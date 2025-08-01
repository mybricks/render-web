/* eslint-disable @typescript-eslint/no-explicit-any */
import { convertComponentStyle, ImportManager } from "./utils";
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

  const { dependencyImport, componentName } =
    config.getComponentMetaByNamespace(meta.def.namespace, { type: "ui" });

  config.addParentDependencyImport(dependencyImport);

  let eventCode = "";
  let comEventCode = "";

  Object.entries(events).forEach(([eventId, { diagramId }]) => {
    if (!diagramId) {
      // 没有添加事件
      return;
    }

    const event = config.getEventByDiagramId(diagramId)!;

    if (!event) {
      // 在引擎内新建了事件后删除，存在脏数据
      return;
    }

    const defaultValue = "value";

    comEventCode += `${eventId}: (${defaultValue}: MyBricks.EventValue) => {
        ${handleProcess(event, {
          ...config,
          addParentDependencyImport: config.addParentDependencyImport,
          getParams: () => {
            return {
              [eventId]: defaultValue,
            };
          },
        })}
    },`;
  });

  const currentProvider = config.getCurrentProvider();
  currentProvider.coms.add(meta.id);

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
        // slot.props.style.width = "100%";
        if (slot.props.style.layout !== "smart") {
          // slot.props.style.width = "100%";
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
          slot.props.style.width = "auto";
        }
      }

      if (com.props.style.height === "fit-content") {
        slot.props.style.height = "auto";
      } else {
        // slot.props.style.height = "100%";
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
        });

        level0Slots.push(...slots);
        level1Slots.push(...scopeSlots);

        eventCode += js; // 非 scope 没有js

        if (!index) {
          // 第一个 if
          currentSlotsCode = `if (params.id === "${slotId}") {
            ${ui}
          }`;
        } else {
          // 其它的 else if
          currentSlotsCode += `else if (params.id === "${slotId}") {
            ${ui}
          }`;
        }
      } else {
        // [TODO] 作用域插槽
        const providerName = `slot_${slot.meta.slotId[0].toUpperCase() + slot.meta.slotId.slice(1)}_${slot.meta.comId}`;
        const currentProvider: ReturnType<BaseConfig["getCurrentProvider"]> = {
          name: providerName,
          class: providerName[0].toUpperCase() + providerName.slice(1),
          controllers: new Set(),
          useParams: false,
          coms: new Set(),
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
          },
        );
        let uiCode = ui;

        currentProvider.coms.add(meta.id);

        level1Slots.push(...scopeSlots);

        const scopeSlotComponentName = `${slotId[0].toUpperCase() + slotId.slice(1)}_${meta.id}`;
        const scene = config.getCurrentScene();
        let slotsCode = slots.join("\n");
        const filterControllers = Array.from(currentProvider.coms).filter(
          (controller) => {
            if (!currentProvider.controllers.has(controller)) {
              uiCode = uiCode.replace(
                `controller: this.${currentProvider.name}.controller_${controller},\n`,
                "",
              );
              slotsCode = slotsCode.replace(
                `controller: this.${currentProvider.name}.controller_${controller},\n`,
                "",
              );
              return false;
            }

            return true;
          },
        );

        const varsDeclarationCode = vars
          ? `/** ${meta.title}（${slot.meta.title}）组件变量 */
      ${vars.varsDeclarationCode}\n`
          : "";
        const fxsDeclarationCode = fxs
          ? `/** ${meta.title}（${slot.meta.title}）组件Fx */
      ${fxs.fxsDeclarationCode}\n`
          : "";
        const classCode =
          filterControllers.length || currentProvider.useParams
            ? `/** ${meta.title}（${slot.meta.title}）组件控制器 */
          class Slot_${scopeSlotComponentName} {
          ${currentProvider.useParams ? "/** 插槽参数 */\nparams: MyBricks.Any" : ""}
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

        let providerCode =
          filterControllers.length || currentProvider.useParams
            ? `@Provider() slot_${scopeSlotComponentName}: Slot_${scopeSlotComponentName} = new Slot_${scopeSlotComponentName}()\n`
            : "";
        if (vars) {
          providerCode += vars.varsImplementCode + "\n";
        }
        if (fxs) {
          providerCode += fxs.fxsImplementCode + "\n";
        }

        level1Slots.push(`${varsDeclarationCode}${fxsDeclarationCode}${classCode}/** ${meta.title}（${slot.meta.title}） */
        @ComponentV2
        struct ${scopeSlotComponentName} {
          @Param @Require params: MyBricks.SlotParams
          ${Array.from(consumers)
            .filter(
              // [TODO] 过滤同名，下一版将consumers改成字符串列表
              (consumer, index, consumers) =>
                index === consumers.findIndex((t) => t.name === consumer.name),
            )
            .map((provider) => {
              return `@Consumer("${provider.name}") ${provider.name}: ${provider.class} = new ${provider.class}()`;
            })
            .join("\n")}
          ${providerCode}

          ${js}

          ${slotsCode}

          build() {
            ${uiCode}
          }
        }`);

        if (!index) {
          // 第一个 if
          currentSlotsCode = `if (params.id === "${slotId}") {
            ${scopeSlotComponentName}({ params })
          }`;
        } else {
          // 其它的 else if
          currentSlotsCode += `else if (params.id === "${slotId}") {
            ${scopeSlotComponentName}({ params })
          }`;
        }
      }
    });

    const resultStyle = convertComponentStyle(props.style);

    return {
      slots: [
        `/** ${meta.title}插槽 */
      @Builder
      slots_${meta.id}(params: MyBricks.SlotParams) {
        ${currentSlotsCode}
      }`,
        ...level0Slots,
      ],
      scopeSlots: level1Slots,
      ui: `/** ${meta.title} */
      ${componentName}({
        uid: "${meta.id}",
        ${config.verbose ? `title: "${meta.title}",` : ""}
        controller: this.${currentProvider.name}.controller_${meta.id},
        data: ${JSON.stringify(props.data)},
        styles: ${JSON.stringify(resultStyle)},
        slots: this.slots_${meta.id}.bind(this),${
          comEventCode
            ? `
        events: {
          ${comEventCode}
        },`
            : ""
        }${com.meta.frameId ? "parentSlot: this.params" : ""}
      })`,
      js: eventCode,
    };
  } else {
    const resultStyle = convertComponentStyle(props.style);

    if (isModule) {
      // 模块组件特殊处理，同模块
      // [TODO] 合并下
      const data = meta.model.data.config;
      const resultStyle = convertComponentStyle(com.props.style);
      return {
        ui: `/** ${meta.title} */
        ${componentName}({
          uid: "${meta.id}",
          ${config.verbose ? `title: "${meta.title}",` : ""}
          controller: this.${currentProvider.name}.controller_${meta.id},
          styles: ${JSON.stringify(resultStyle)},
          ${data ? `data: ${JSON.stringify(data)},` : ""}
        })`,
        js: eventCode,
        slots: [],
        scopeSlots: [],
      };
    }

    return {
      ui: `/** ${meta.title} */
      ${componentName}({
        uid: "${meta.id}",
        ${config.verbose ? `title: "${meta.title}",` : ""}
        controller: this.${currentProvider.name}.controller_${meta.id},
        data: ${JSON.stringify(props.data)},
        styles: ${JSON.stringify(resultStyle)},${
          comEventCode
            ? `
        events: {
          ${comEventCode}
        },`
            : ""
        }${com.meta.frameId ? "parentSlot: this.params" : ""}
      })`,
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

  process.nodesDeclaration.forEach(({ meta, props }: any) => {
    if (meta.def.namespace.startsWith("mybricks.harmony.module")) {
      // 模块特殊处理
      return;
    }
    if (meta.def.namespace === "mybricks.harmony._muilt-inputJs") {
      config.addParentDependencyImport({
        packageName: config.getComponentPackageName(),
        dependencyNames: ["codes"],
        importType: "named",
      });
      // JS计算特殊逻辑，运行时是内置实现的
      const componentNameWithId = `jsCode_${meta.id}`;

      code += `/** ${meta.title} */
      const ${componentNameWithId} = codes.${meta.id}({
        ${config.verbose ? `title: "${meta.title}",` : ""}
        data: ${JSON.stringify({ runImmediate: !!props.data.runImmediate })},
        inputs: ${JSON.stringify(props.inputs)},
        outputs: ${JSON.stringify(props.outputs)},
      })\n`;

      return;
    }
    if (meta.def.namespace === "mybricks.core-comlib.bus-getUser") {
      return;
    }

    const { dependencyImport, componentName } =
      config.getComponentMetaByNamespace(meta.def.namespace, {
        type: "js",
      });

    config.addParentDependencyImport(dependencyImport);

    const componentNameWithId = `${componentName}_${meta.id}`;

    code += `/** ${meta.title} */
    const ${componentNameWithId} = ${componentName}({${Object.entries(
      props,
    ).reduce((pre, [key, value], index) => {
      if (!index && config.verbose) {
        pre += `title: "${meta.title}",`;
      }
      if (key === "data") {
        return pre + `${key}: ${JSON.stringify(value)},`;
      }
      return pre + `${key}: ${JSON.stringify(value)},`;
    }, "")}})\n`;
  });

  process.nodesInvocation.forEach((props: any) => {
    const { componentType, category, runType } = props;
    // 参数
    const nextValue = getNextValue(props, config);

    // if (props.meta.def?.namespace.startsWith("mybricks.harmony.module")) {
    //   // frameoutput没有def
    //   // 模块特殊处理，没有输出，调用api.open
    //   if (props.componentType === "js") {
    //     const { componentName, dependencyImport } =
    //       config.getComponentMetaByNamespace(props.meta.def.namespace, {
    //         type: "js",
    //       });

    //     config.addParentDependencyImport(dependencyImport);
    //     if (code) {
    //       // 换行
    //       code += "\n";
    //     }
    //     code += `/** 打开模块 */
    //     ${componentName}.${props.id}(${nextValue})`;
    //     return;
    //   }
    // }

    const isSameScope = checkIsSameScope(event, props);
    // 节点执行后的返回值（输出）
    const nextCode = getNextCode(props, config, isSameScope);

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
        // const componentNameWithId = getComponentNameWithId(props, config);

        const _sceneId = props.meta.model.data._sceneId;

        code += `/** 打开 ${props.meta.title} */
        ${nextCode}page.open("${config.getPageId?.(_sceneId) || _sceneId}", ${nextValue})`;
        // code += `const ${componentNameWithId}_result = page.open("${props.meta.model.data._sceneId}", ${nextValue})`;
      } else if (category === "normal") {
        let componentNameWithId = getComponentNameWithId(props, config);
        if (props.meta.def?.namespace.startsWith("mybricks.harmony.module")) {
          const { componentName, dependencyImport } =
            config.getComponentMetaByNamespace(props.meta.def.namespace, {
              type: "js",
            });

          config.addParentDependencyImport(dependencyImport);

          const api =
            config.getApi?.(props.meta.def.namespace).title || props.meta.title;

          componentNameWithId = `${componentName}.${api}`;
        }
        code += `/** 调用 ${props.meta.title} */
        ${nextCode}${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
        // code += `const ${componentNameWithId}_result = ${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
      } else if (category === "frameOutput") {
        // [TODO] 判断是弹窗输出还是业务模块输出
        config.addParentDependencyImport({
          packageName: "../api",
          dependencyNames: ["api"],
          importType: "default",
        });
        const scene = config.getCurrentScene();
        const pinProxy = scene.pinProxies[`${props.meta.id}-${props.id}`];
        code += `/** 调用模块注册回调 ${props.meta.title} */
        ${nextCode}api.emit("${pinProxy.pinId}", ${nextValue})`;
      } else if (category === "var") {
        if (props.meta.global) {
          config.addParentDependencyImport({
            packageName: config.getComponentPackageName(),
            dependencyNames: ["globalVars"],
            importType: "named",
          });
          if (props.runType === "auto") {
            // 变量自执行特殊处理
            code += `/** ${props.title} 全局变量 ${props.meta.title} */
            ${nextCode}globalVars.${props.meta.title}.changed()`;
          } else {
            code += `/** ${props.title} 全局变量 ${props.meta.title} */
            ${nextCode}globalVars.${props.meta.title}.${props.id}(${nextValue})`;
          }
        } else {
          const currentProvider = getCurrentProvider(
            { isSameScope, props },
            config,
          );

          code += `/** ${props.title} 变量 ${props.meta.title} */
          ${nextCode}this.${currentProvider.name}_Vars.${props.meta.title}.${props.id}(${nextValue})`;
        }
      } else if (category === "fx") {
        if (props.meta.global) {
          config.addParentDependencyImport({
            packageName: config.getComponentPackageName(),
            dependencyNames: ["globalFxs"],
            importType: "named",
          });
          code += `/** 调用全局Fx ${props.meta.title} */
          ${nextCode}globalFxs.${props.meta.ioProxy.id}(${nextValue})`;
        } else {
          const currentProvider = getCurrentProvider(
            { isSameScope, props },
            config,
          );

          code += `/** 调用Fx ${props.meta.title} */
          ${nextCode}this.${currentProvider.name}_Fxs.${props.meta.ioProxy.id}(${nextValue})`;
        }
      } else if (category === "bus") {
        const componentNameWithId = getComponentNameWithId(props, config);

        code += `/** 调用 ${props.meta.title} */
        ${nextCode}${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
      } else if (category === "frameInput") {
        const scene = config.getCurrentScene();
        const pinValueProxy =
          scene.pinValueProxies[`${props.meta.id}-${props.id}`];
        const params = config.getParams();
        const { frameKey } = props;
        if (frameKey === "_rootFrame_") {
          // 场景输入
          code += `/** 调用获取当前输入值 ${props.title} */
          ${nextCode}join(${nextValue}, ${params[pinValueProxy.pinId]})`;
        } else {
          const [comId, slotId] = frameKey.split("-");

          if (comId === props.meta.parentComId) {
            // 同作用域
            code += `/** 调用获取当前输入值 ${props.title} */
            ${nextCode}join(${nextValue}, this.params.inputValues.${pinValueProxy.pinId})`;
          } else {
            // 跨作用域
            const scopeSlotComponentName = `${slotId[0].toUpperCase() + slotId.slice(1)}_${comId}`;
            const providerMap = config.getProviderMap();

            const provider = providerMap[`slot_${scopeSlotComponentName}`];
            provider.useParams = true;

            config.addConsumer(provider);

            code += `/** 调用获取当前输入值 ${props.title} */
            ${nextCode}join(${nextValue}, this.slot_${scopeSlotComponentName}.params.inputValues.${pinValueProxy.pinId})`;
          }
        }
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
        code += `/** 调用页面输出 ${props.title} */
        page.${props.id}("${config.getPageId?.(id) || id}", ${nextValue})`;
        return;
      }

      if (props.type === "frameOutput") {
        if (props.category === "extension-api") {
          // extension-api卡片特殊处理
          code += `/** 调用api回调 ${props.title} */
          callBack.${props.id}(${nextValue});`;
          return;
        }

        if (props.category === "extension") {
          code += `/** 调用api.emit ${props.title} */
          this.emit("${props.id}", ${nextValue})`;
          return;
        }
        code += `/** 调用插槽输出 ${props.title} */
        this.params.outputs.${props.id}(${nextValue})`;
        return;
      }

      if (category === "module") {
        if (props.type === "frameRelOutput") {
          code += `this.controller.outputs.${props.id}(${nextValue})`;
          return;
        } else if (props.type === "exe") {
          const currentProvider = getCurrentProvider(
            { isSameScope, props },
            config,
          );
          currentProvider.controllers.add(props.meta.id);

          code += `${nextCode}this.${currentProvider.name}.controller_${props.meta.id}.${props.id}(${nextValue})`;
          return;
        }
      }
      // ui
      const currentProvider = getCurrentProvider(
        { isSameScope, props },
        config,
      );
      currentProvider.controllers.add(props.meta.id);

      code += `/** 调用 ${props.meta.title} 的 ${props.title} */
      ${nextCode}this.${currentProvider.name}.controller_${props.meta.id}.${props.id}(${nextValue})`;
    }
  });
  if (["fx", "extension-api", "extension-bus"].includes(event.type)) {
    const returnCode = Object.entries(event.frameOutputs)
      .map(([, { id, outputs }]: any) => {
        if (!outputs) {
          return `${id}: undefined`;
        } else {
          const next = `${outputs
            .map((output: any) => {
              return getNextValueWithParam(output, config);
            })
            .join(",")}`;

          if (outputs.length > 1) {
            return `${id}: mergeSubjects(${next})`;
          }

          return `${id}: ${next}`;
        }
      })
      .join(",");

    if (returnCode) {
      code += `\nreturn {${returnCode}}`;
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
  }

  return false;
};

const getComponentNameWithId = (props: any, config: HandleProcessConfig) => {
  const { componentType, category, meta, moduleId, type } = props;
  if (componentType === "js") {
    if (props.meta.def.namespace === "mybricks.harmony._muilt-inputJs") {
      // JS计算特殊逻辑，运行时是内置实现的
      return `jsCode_${meta.id}`;
    } else if (props.meta.def.namespace === "mybricks.core-comlib.scenes") {
      // 场景打开特殊处理，运行时内置实现
      return `page_${meta.id}`;
    } else if (
      props.meta.def.namespace === "mybricks.core-comlib.frame-output"
    ) {
      // frame输出特殊处理，运行时内置实现
      return `api_${meta.id}`;
    } else if (category === "var") {
      if (meta.global) {
        // globalVars_token_id_result
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
  }
  const { componentName } = config.getComponentMetaByNamespace(
    props.meta.def.namespace,
    {
      type: componentType,
    },
  );
  return `${componentName}_${meta.id}`;
};

const getNextCode = (
  props: any,
  config: HandleProcessConfig,
  isSameScope: boolean,
) => {
  // 节点执行后的返回值（输出）
  const { nextParam, componentType, category } = props;
  if (!nextParam.length) {
    return "";
  }
  const componentNameWithId = getComponentNameWithId(props, config);

  if (componentType === "js") {
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
    return `const ${componentNameWithId}_result = `;
    // if (category === "var") {
    //   return nextParam.length
    //     ? `const ${componentNameWithId}_${nextParam[0].connectId} = `
    //     : "";
    // } else if (category === "fx") {
    //   return nextParam.length
    //     ? `const [${nextParam.map(({ id }: any) => {
    //         return `${componentNameWithId}_${id}`;
    //       })}] = `
    //     : "";
    // }
  }

  // ui
  getCurrentProvider({ isSameScope, props }, config);

  if (!nextParam.length) {
    return "";
  }

  return `const ${props.meta.id}_${nextParam[0].id}_${nextParam[0].connectId} = `;
};

const getNextValue = (props: any, config: HandleProcessConfig) => {
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
    const componentNameWithId = getComponentNameWithId(param, config);
    if (connectId) {
      if (componentType === "js" && category === "var") {
        return `${componentNameWithId}_${connectId}`;
      }
      // ui
      return `${param.meta.id}_${param.id}_${param.connectId}.${param.id}`;
      // return `${componentNameWithId}_${id}_${connectId}`;
    }
    if (param.category === "frameOutput") {
      return `${componentNameWithId}_result`;
    } else if (param.category === "bus") {
      return `bus_${param.meta.id}.${id}`;
    } else if (param.category === "frameInput") {
      return `${componentNameWithId}_result`;
    }
    return `${componentNameWithId}_result.${id}`;
  });

  return nextValue;
};

const getNextValueWithParam = (param: any, config: HandleProcessConfig) => {
  if (param.type === "params") {
    const params = config.getParams();
    return params[param.id];
  }
  // [TODO] 这里要判断类型的
  const { id, connectId, category, componentType } = param;
  const componentNameWithId = getComponentNameWithId(param, config);
  if (connectId) {
    if (componentType === "js" && category === "var") {
      return `${componentNameWithId}_${connectId}`;
    }
    return `${componentNameWithId}_${id}_${connectId}`;
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

  const provider = !parentComId
    ? providerMap[`slot_Index`]
    : providerMap[
        `slot_${frameId[0].toUpperCase() + frameId.slice(1)}_${parentComId}`
      ];

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
