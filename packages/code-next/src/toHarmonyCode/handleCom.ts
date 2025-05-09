/* eslint-disable @typescript-eslint/no-explicit-any */
import { createDependencyImportCollector } from "./utils";
import handleSlot from "./handleSlot";

import type { UI, BaseConfig } from "./index";

export type Com = Extract<UI["children"][0], { type: "com" }>;

type HandleComResult = {
  // code: string;
  ui: string;
  js: string;
  slots: string[];
};

export interface HandleComConfig extends BaseConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addController: (controller: string) => void;
  addSlotContext: (slotContext: string) => void;
}

const handleCom = (com: Com, config: HandleComConfig): HandleComResult => {
  const { meta, props, slots, events } = com;
  // config.addParentDependencyImport({
  //   packageName: "react",
  //   dependencyName: "useRef",
  //   importType: "named",
  // });

  const { dependencyImport, componentName } =
    config.getComponentMetaByNamespace(meta.def.namespace);

  config.addParentDependencyImport(dependencyImport);
  // const componentNameWithId = `${componentName}_${meta.id}`;
  config.addController(
    `${componentName}Controller_${meta.id} = new ${componentName}Controller()`,
  );

  // let propsCode = Object.entries(props).reduce((pre, [key, value]) => {
  //   if (key === "data") {
  //     return pre + `${key}={${JSON.stringify(value)}} `;
  //   }
  //   return pre + `${key}={${JSON.stringify(value)}} `;
  // }, `ref={${componentNameWithId}_ref}`);

  let eventCode = "";
  let comEventCode = "";

  Object.entries(events).forEach(([eventId, { diagramId }]) => {
    // propsCode += `${eventId}={${componentNameWithId}_${eventId}}`;
    const event = config.getEventByDiagramId(diagramId)!;
    const defaultValue = "value";

    // u_xxx11_click = (value: string) => {
    //   this.u_xxx11_Controller.setText(`${value} - ${Math.random()}`)
    // }

    // [TODO] 类型分析
    eventCode += `${componentName}_${meta.id}_${eventId} = (${defaultValue}: string) => {
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

    comEventCode += `${eventId}: this.${componentName}_${meta.id}_${eventId},`;
    // click: this.MyBricksButton_u_b9EoS_onClick
  });

  if (slots) {
    // 当前组件的插槽
    let currentSlotsCode = "";
    // 同级插槽，非作用域下层
    const level0Slots: string[] = [];

    Object.entries(slots).forEach(([slotId, slot], index) => {
      if (!slot.meta.scope) {
        const { js, ui, slots } = handleSlot(slot, {
          ...config,
          checkIsRoot: () => {
            return false;
          },
        });

        level0Slots.push(...slots);

        eventCode += js; // 非 scope 没有js

        if (!index) {
          // 第一个 if
          currentSlotsCode = `if (type === "${slotId}") {
            ${ui}
          }`;
        } else {
          // 其它的 else if
          currentSlotsCode += `else if (type === "${slotId}") {
            ${ui}
          }`;
        }
      } else {
        // [TODO] 作用域插槽
      }
    });

    // [TODO]
    const resultStyle: any = {};
    const rootStyle: any = {};
    Object.entries(props.style).forEach(([key, value]) => {
      if (key === "_new" || key === "themesId" || key === "visibility") {
        return;
      } else if (key === "styleAry") {
        value.forEach(({ css, selector }: any) => {
          resultStyle[selector] = css;
        });
      } else {
        if (typeof value === "string" || typeof value === "number") {
          rootStyle[key] = value;
        }
      }
    });
    resultStyle["root"] = rootStyle;

    // HACK
    if (meta.def.namespace === "mybricks.taro.systemPage") {
      props.data = {
        background: props.data.background,
      };
    }

    return {
      slots: [
        `@Builder
      ${componentName}_${meta.id}_slots(type: string) {
        ${currentSlotsCode}
      }`,
        ...level0Slots,
      ],
      ui: `${componentName}({
        controller: this.${componentName}Controller_${meta.id},
        data: ${JSON.stringify(props.data)},
        styles: ${JSON.stringify(resultStyle)},
        slots: (type: string): void => this.${componentName}_${meta.id}_slots(type),${
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
    // [TODO]
    const resultStyle: any = {};
    const rootStyle: any = {};
    Object.entries(props.style).forEach(([key, value]) => {
      if (key === "_new" || key === "themesId" || key === "visibility") {
        return;
      } else if (key === "styleAry") {
        value.forEach(({ css, selector }: any) => {
          resultStyle[selector] = css;
        });
      } else {
        if (typeof value === "string" || typeof value === "number") {
          rootStyle[key] = value;
        }
      }
    });
    resultStyle["root"] = rootStyle;

    return {
      ui: `${componentName}({
        controller: this.${componentName}Controller_${meta.id},
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
    };
  }
};

export default handleCom;

interface HandleProcessConfig extends BaseConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  getParams: () => Record<string, string>;
  addSlotContext: (slotContext: string) => void;
}

export const handleProcess = (
  event: Exclude<ReturnType<BaseConfig["getEventByDiagramId"]>, undefined>,
  config: HandleProcessConfig,
) => {
  let code = "";
  const { process } = event;

  process.nodesDeclaration.forEach(({ meta, props }: any) => {
    const { dependencyImport, componentName } =
      config.getComponentMetaByNamespace(meta.def.namespace);
    config.addParentDependencyImport(dependencyImport);

    const componentNameWithId = `${componentName}_${meta.id}`;

    code += `const ${componentNameWithId} = ${componentName}({${Object.entries(
      props,
    ).reduce((pre, [key, value]) => {
      if (key === "data") {
        return pre + `${key}: ${JSON.stringify(value)},`;
      }
      return pre + `${key}: ${JSON.stringify(value)},`;
    }, "")}});\n`;
  });

  process.nodesInvocation.forEach((props: any) => {
    const { componentType, category } = props;

    // let componentNameWithId = getComponentNameWithId(props, config);
    // 节点执行后的返回值（输出）
    // const nextCode = getNextCode(props, config);
    // let nextInput = "";
    // 参数
    const nextValue = getNextValue(props, config);
    // const isSameScope = checkIsSameScope(event, props);

    if (componentType === "js") {
      // 如何执行 js要区分自执行还是调用输入

      if (category === "scene") {
        // 导入页面路由模块
        config.addParentDependencyImport({
          packageName: "@kit.ArkUI",
          dependencyNames: ["router"],
          importType: "named",
        });
        code += `router.pushUrl({ url: 'pages/Page_${props.meta.model.data._sceneId}'})`;
      }
    } else {
      // ui
      // [TODO] 作用域判断
      const { componentName } = config.getComponentMetaByNamespace(
        props.meta.def.namespace,
      );
      code += `this.${componentName}Controller_${props.meta.id}.${props.id}(${nextValue})`;
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

// const getDifferentScopeComponentNameWithId = (params: {
//   componentNameWithId: string;
//   props: any;
//   category: string;
// }) => {
//   const { componentNameWithId, props, category } = params;
//   if (props.meta.parentComId) {
//     // 在作用域里
//     return `slotContext_${props.meta.parentComId}_${props.meta.frameId}.${category}.${componentNameWithId}`;
//   } else {
//     // 主场景
//     return `slotContext.${category}.${componentNameWithId}`;
//   }
// };

/** 判断是否当前作用域 */
// const checkIsSameScope = (event: any, props: any) => {
//   if (
//     event.type === "com" &&
//     event.meta.parentComId === props.meta.parentComId &&
//     event.meta.frameId === props.meta.frameId
//   ) {
//     // 当前作用域
//     return true;
//   } else if (
//     event.type === "slot" &&
//     event.comId === props.meta.parentComId &&
//     event.slotId === props.meta.frameId
//   ) {
//     // 当前作用域
//     return true;
//   } else if (
//     event.type === "fx" &&
//     event.parentComId === props.meta.parentComId &&
//     event.parentSlotId === props.meta.frameId
//   ) {
//     return true;
//   }

//   return false;
// };

const getComponentNameWithId = (props: any, config: HandleProcessConfig) => {
  const { componentType, category, meta, moduleId, type } = props;
  if (componentType === "js") {
    if (category === "var") {
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
  );
  return `${componentName}_${meta.id}`;
};

// const getNextCode = (props: any, config: HandleProcessConfig) => {
//   // 节点执行后的返回值（输出）
//   const { nextParam, componentType, category } = props;
//   const componentNameWithId = getComponentNameWithId(props, config);

//   if (componentType === "js") {
//     if (category === "var") {
//       return nextParam.length
//         ? `const ${componentNameWithId}_${nextParam[0].connectId} = `
//         : "";
//     } else if (category === "fx") {
//       return nextParam.length
//         ? `const [${nextParam.map(({ id }: any) => {
//             return `${componentNameWithId}_${id}`;
//           })}] = `
//         : "";
//     }
//   }
//   return nextParam.length
//     ? `const {${nextParam
//         .map(({ id, connectId }: any) => {
//           if (connectId) {
//             return `${id}: ${componentNameWithId}_${id}_${connectId}`;
//           }
//           return `${id}: ${componentNameWithId}_${id}`;
//         })
//         .join(",")}} = `
//     : "";
// };

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
      return `${componentNameWithId}_${id}_${connectId}`;
    }
    return `${componentNameWithId}_${id}`;
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
