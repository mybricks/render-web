/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createDependencyImportCollector,
  convertComponentStyle,
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
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addController: (controller: string) => void;
  addConsumer: (provider: { name: string; class: string }) => void;
}

const handleCom = (com: Com, config: HandleComConfig): HandleComResult => {
  const { meta, props, slots, events } = com;
  const { dependencyImport, componentName } =
    config.getComponentMetaByNamespace(meta.def.namespace, { type: "ui" });

  config.addParentDependencyImport(dependencyImport);
  config.addController(meta.id);

  let eventCode = "";
  let comEventCode = "";

  Object.entries(events).forEach(([eventId, { diagramId }]) => {
    if (!diagramId) {
      // 没有添加事件
      // comEventCode += `${eventId}: () => {},`;
      return;
    }

    const event = config.getEventByDiagramId(diagramId)!;

    if (!event) {
      // 在引擎内新建了事件后删除，存在脏数据
      // comEventCode += `${eventId}: () => {},`;
      return;
    }

    const defaultValue = "value";

    // [TODO] 类型分析
    eventCode += `/** ${event.title} */
    ${eventId}_${meta.id} = (${defaultValue}: MyBricks.EventValue) => {
    ${handleProcess(event, {
      ...config,
      addParentDependencyImport: config.addParentDependencyImport,
      getParams: () => {
        return {
          [eventId]: defaultValue,
        };
      },
    })}
  }\n`;

    comEventCode += `${eventId}: this.${eventId}_${meta.id},`;
  });

  const currentProvider = config.getCurrentProvider();
  const providerMetaMap = config.getProviderMetaMap();
  if (!providerMetaMap[meta.id]) {
    providerMetaMap[meta.id] = currentProvider;
  }

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
        slot.props.style.width = "100%";
      }

      if (com.props.style.height === "fit-content") {
        slot.props.style.height = "auto";
      } else {
        slot.props.style.height = "100%";
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
        const currentProvider = {
          name: `slot_${slot.meta.slotId[0].toUpperCase() + slot.meta.slotId.slice(1)}_${slot.meta.comId}`,
          class: `Slot_${slot.meta.slotId[0].toUpperCase() + slot.meta.slotId.slice(1)}_${slot.meta.comId}`,
        };
        const { js, ui, slots, scopeSlots, controllers, consumers } =
          handleSlot(slot, {
            ...config,
            checkIsRoot: () => {
              return false;
            },
          });
        let uiCode = ui;

        config.addController(meta.id);

        level1Slots.push(...scopeSlots);

        const scopeSlotComponentName = `${slotId[0].toUpperCase() + slotId.slice(1)}_${meta.id}`;
        const scene = config.getCurrentScene();
        const usedControllers = config.getUsedControllers();
        let slotsCode = slots.join("\n");
        const filterControllers = Array.from(controllers).filter(
          (controller) => {
            if (!usedControllers.has(controller)) {
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

        const classCode = filterControllers.length
          ? `/** ${meta.title}（${slot.meta.title}）组件控制器 */
          class Slot_${scopeSlotComponentName} {
          ${filterControllers
            .map((controller) => {
              const com = scene.coms[controller];
              return `/** ${com.title} */\ncontroller_${com.id} = Controller()`;
            })
            .join("\n")}
        }\n`
          : "";

        const providerCode = filterControllers.length
          ? `@Provider() slot_${scopeSlotComponentName}: Slot_${scopeSlotComponentName} = new Slot_${scopeSlotComponentName}()\n`
          : "";

        level1Slots.push(`${classCode}/** ${meta.title}（${slot.meta.title}） */
        @ComponentV2
        struct ${scopeSlotComponentName} {
          @Param @Require inputValues: MyBricks.SlotParamsInputValues;
          ${providerCode}
          ${Array.from(consumers)
            .map((provider) => {
              return `@Consumer("${provider.name}") ${provider.name}: ${provider.class} = new ${provider.class}()`;
            })
            .join("\n")}

          ${js}

          ${slotsCode}

          build() {
            ${uiCode}
          }
        }`);

        if (!index) {
          // 第一个 if
          currentSlotsCode = `if (params.id === "${slotId}") {
            ${scopeSlotComponentName}({
              inputValues: params.inputValues,
            })
          }`;
        } else {
          // 其它的 else if
          currentSlotsCode += `else if (params.id === "${slotId}") {
            ${scopeSlotComponentName}({
              inputValues: params.inputValues,
            })
          }`;
        }
      }
    });

    const resultStyle = convertComponentStyle(props.style);

    // HACK
    if (meta.def.namespace === "mybricks.harmony.systemPage") {
      props.data = {
        background: props.data.background,
      };
    }

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
        controller: this.${currentProvider.name}.controller_${meta.id},
        data: ${JSON.stringify(props.data)},
        styles: ${JSON.stringify(resultStyle)},
        slots: this.slots_${meta.id}.bind(this),${
          comEventCode
            ? `
        events: {
          ${comEventCode}
        }`
            : ""
        }
      })`,
      js: eventCode,
    };
  } else {
    const resultStyle = convertComponentStyle(props.style);

    return {
      ui: `/** ${meta.title} */
      ${componentName}({
        controller: this.${currentProvider.name}.controller_${meta.id},
        data: ${JSON.stringify(props.data)},
        styles: ${JSON.stringify(resultStyle)},${
          comEventCode
            ? `
        events: {
          ${comEventCode}
        }`
            : ""
        }
      })`,
      js: eventCode,
      slots: [],
      scopeSlots: [],
    };
  }
};

export default handleCom;

interface HandleProcessConfig extends BaseConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  getParams: () => Record<string, string>;
  addConsumer: (provider: { name: string; class: string }) => void;
}

export const handleProcess = (
  event: Exclude<ReturnType<BaseConfig["getEventByDiagramId"]>, undefined>,
  config: HandleProcessConfig,
) => {
  let code = "";
  const { process } = event;

  process.nodesDeclaration.forEach(({ meta, props }: any) => {
    const { dependencyImport, componentName } =
      config.getComponentMetaByNamespace(meta.def.namespace, {
        type: "js",
      });
    config.addParentDependencyImport(dependencyImport);
    if (meta.def.namespace === "mybricks.harmony._muilt-inputJs") {
      // JS计算特殊逻辑，运行时是内置实现的
      const componentNameWithId = `jsCode_${meta.id}`;

      code += `const ${componentNameWithId} = codes.${meta.id}({
        data: ${JSON.stringify({ runImmediate: !!props.data.runImmediate })},
        inputs: ${JSON.stringify(props.inputs)},
        outputs: ${JSON.stringify(props.outputs)},
      })\n`;

      return;
    }

    const componentNameWithId = `${componentName}_${meta.id}`;

    code += `const ${componentNameWithId} = ${componentName}({${Object.entries(
      props,
    ).reduce((pre, [key, value]) => {
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
          packageName: "../_proxy", // [TODO] 这些应该都是约定的
          dependencyNames: ["page"],
          importType: "named",
        });
        // const componentNameWithId = getComponentNameWithId(props, config);
        code += `${nextCode}page.open("${props.meta.model.data._sceneId}", ${nextValue})`;
        // code += `const ${componentNameWithId}_result = page.open("${props.meta.model.data._sceneId}", ${nextValue})`;
      } else if (category === "normal") {
        const componentNameWithId = getComponentNameWithId(props, config);
        code += `${nextCode}${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
        // code += `const ${componentNameWithId}_result = ${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
      } else {
        console.log("[出码] 其它类型js节点");
      }
    } else {
      if (category === "popup") {
        // popup类型的输出
        // [TODO] 后续观察是否需要判断props.type === frameOutput
        config.addParentDependencyImport({
          packageName: "../_proxy", // [TODO] 这些应该都是约定的
          dependencyNames: ["page"],
          importType: "named",
        });
        code += `page.${props.id}("${props.meta.id}", ${nextValue})`;
        return;
      }

      // ui
      let currentProvider = config.getCurrentProvider();

      if (!isSameScope) {
        const providerMetaMap = config.getProviderMetaMap();
        currentProvider = providerMetaMap[props.meta.id];
        // 非当前作用域，借助@Consumer调用上层组件
        config.addConsumer(currentProvider);
      }

      const usedControllers = config.getUsedControllers();
      usedControllers.add(props.meta.id);

      code += `${nextCode}this.${currentProvider.name}.controller_${props.meta.id}.${props.id}(${nextValue})`;
    }
  });
  if (event.type === "fx") {
    const returnCode = Object.entries(event.frameOutputs)
      .map(([, { outputs }]: any) => {
        if (!outputs) {
          return "null";
        } else {
          const next = `${outputs
            .map((output: any) => {
              return getNextValueWithParam(output, config);
            })
            .join(",")}`;

          if (outputs.length > 1) {
            return `[merge(${next})]`;
          }

          return next;
        }
      })
      .join(",");

    if (returnCode) {
      code += `return [${returnCode}]`;
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
    } else if (category === "var") {
      return `var_${meta.id}`;
    } else if (category === "fx") {
      return `fx_${meta.ioProxy.id}`;
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
  const { nextParam, componentType } = props;
  if (!nextParam.length) {
    return "";
  }
  const componentNameWithId = getComponentNameWithId(props, config);

  if (componentType === "js") {
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
  let currentProvider = config.getCurrentProvider();

  if (!isSameScope) {
    const providerMetaMap = config.getProviderMetaMap();
    currentProvider = providerMetaMap[props.meta.id];
    // 非当前作用域，借助@Consumer调用上层组件
    config.addConsumer(currentProvider);
  }

  if (!nextParam.length) {
    return "";
  }

  return `const ${props.meta.id}_${nextParam[0].id}_${nextParam[0].connectId} = `;

  // return `this.${currentProvider.name}.controller_${props.meta.id}.${props.id}(${nextValue})`

  // return nextParam.length
  //   ? `const {${nextParam
  //       .map(({ id, connectId }: any) => {
  //         if (connectId) {
  //           return `${id}: ${componentNameWithId}_${id}_${connectId}`;
  //         }
  //         return `${id}: ${componentNameWithId}_${id}`;
  //       })
  //       .join(",")}} = `
  //   : "";
};

const getNextValue = (props: any, config: HandleProcessConfig) => {
  const { paramSource } = props;
  const nextValue = paramSource.map((param: any) => {
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
      // ui
      return `${param.meta.id}_${param.id}_${param.connectId}.${param.id}`;
      // return `${componentNameWithId}_${id}_${connectId}`;
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
  return `${componentNameWithId}_${id}`;
};
