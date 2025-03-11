/* eslint-disable @typescript-eslint/no-explicit-any */
import { createDependencyImportCollector } from "./utils";
import { deepObjectDiff } from "../utils";
import handleSlot from "./handleSlot";

import type { UI, BaseConfig } from "./index";

export type Com = Extract<UI["children"][0], { type: "com" }>;

type HandleComResult = {
  // code: string;
  ui: string;
  js: string;
};

export interface HandleComConfig extends BaseConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addRefName: (refName: string) => void;
  addSlotContext: (slotContext: string) => void;
}

const handleCom = (com: Com, config: HandleComConfig): HandleComResult => {
  const { meta, props, slots, events } = com;
  config.addParentDependencyImport({
    packageName: "react",
    dependencyName: "useRef",
    importType: "named",
  });
  config.addParentDependencyImport(
    config.getComponentDependencyImportByNamespace(meta.def.namespace),
  );

  const componentName = config.getComponentNameByNamespace(meta.def.namespace);
  const componentNameWithId = `${componentName}_${meta.id}`;
  config.addRefName(componentNameWithId);

  let propsCode = Object.entries(props).reduce((pre, [key, value]) => {
    if (key === "data") {
      return (
        pre +
        `${key}={${JSON.stringify(deepObjectDiff(config.getDefaultDataByNamespace(meta.def.namespace), value))}} `
      );
    }
    return pre + `${key}={${JSON.stringify(value)}} `;
  }, `ref={${componentNameWithId}_ref}`);

  let eventCode = "";

  Object.entries(events).forEach(([eventId, { diagramId }]) => {
    propsCode += `${eventId}={${componentNameWithId}_${eventId}}`;
    const event = config.getEventByDiagramId(diagramId)!;
    const defaultValue = "value";

    eventCode += `const ${componentNameWithId}_${eventId} = (${defaultValue}) => {
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
  });

  if (slots) {
    config.addParentDependencyImport({
      packageName: "@mybricks/render-react-hoc",
      dependencyName: "Slot",
      importType: "named",
    });
    let childCode = "";
    Object.entries(slots).forEach(([slotId, slot]) => {
      if (!slot.meta.scope) {
        const { js, ui } = handleSlot(slot, {
          ...config,
          checkIsRoot: () => {
            return false;
          },
        });

        eventCode += js; // 非 scope 没有js
        childCode += `<Slot id="${slotId}">{() => {
          return ${ui};
        }}</Slot>`;
      } else {
        // [TODO] 作用域插槽
        const slotRelativePathMap = Object.entries(
          config.getSlotRelativePathMap(),
        ).reduce(
          (pre: Record<string, string>, [key, value]) => {
            pre[key] = `${value}../../`;
            return pre;
          },
          {
            [`${slot.meta.comId}-${slot.meta.slotId}`]: "",
          },
        );

        const { js, ui } = handleSlot(slot, {
          ...config,
          checkIsRoot: () => {
            return false;
          },
          getSlotRelativePathMap: () => {
            return slotRelativePathMap;
          },
        });

        eventCode += js; // 非 scope 没有js
        childCode += ui;
      }
    });
    return {
      ui: `<${componentName} ${propsCode}>${childCode}</${componentName}>`,
      js: eventCode,
    };
  } else {
    return {
      ui: `<${componentName} ${propsCode}/>`,
      js: eventCode,
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
    config.addParentDependencyImport(
      config.getComponentDependencyImportByNamespace(meta.def.namespace),
    );

    const componentName = config.getComponentNameByNamespace(
      meta.def.namespace,
    );
    const componentNameWithId = `${componentName}_${meta.id}`;

    code += `const ${componentNameWithId} = ${componentName}({${Object.entries(
      props,
    ).reduce((pre, [key, value]) => {
      if (key === "data") {
        return (
          pre +
          `${key}: ${JSON.stringify(deepObjectDiff(config.getDefaultDataByNamespace(meta.def.namespace), value))},`
        );
      }
      return pre + `${key}: ${JSON.stringify(value)},`;
    }, "")}});\n`;
  });

  process.nodesInvocation.forEach((props: any) => {
    const { componentType, runType, category } = props;
    let componentNameWithId = getComponentNameWithId(props, config);
    // 节点执行后的返回值（输出）
    const nextCode = getNextCode(props, config);
    let nextInput = "";
    // 参数
    const nextValue = getNextValue(props, config);
    const isSameScope = checkIsSameScope(event, props);

    if (componentType === "js") {
      // 如何执行 js要区分自执行还是调用输入
      nextInput = runType === "input" ? ".input" : "";
      if (category === "var") {
        nextInput = `.${props.id}`;
        if (!isSameScope) {
          // 非当前作用域
          componentNameWithId = getDifferentScopeComponentNameWithId({
            componentNameWithId,
            props,
            category,
          });
        }
      } else if (category === "fx") {
        nextInput = "";
        if (!isSameScope) {
          // 非当前作用域
          componentNameWithId = getDifferentScopeComponentNameWithId({
            componentNameWithId,
            props,
            category,
          });
        }
      }
    } else {
      nextInput = `_ref.current.inputs.${props.id}`;
      if (!isSameScope) {
        // 非当前作用域
        config.addSlotContext(
          props.meta.parentComId
            ? `${props.meta.parentComId}-${props.meta.frameId}`
            : "", // 空字符串，认为是主场景
        );

        componentNameWithId = getDifferentScopeComponentNameWithId({
          componentNameWithId,
          props,
          category,
        });
      }
    }

    code += `${nextCode}${componentNameWithId}${nextInput}(${nextValue});\n`;
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

const getDifferentScopeComponentNameWithId = (params: {
  componentNameWithId: string;
  props: any;
  category: string;
}) => {
  const { componentNameWithId, props, category } = params;
  if (props.meta.parentComId) {
    // 在作用域里
    return `slotContext_${props.meta.parentComId}_${props.meta.frameId}.${category}.${componentNameWithId}`;
  } else {
    // 主场景
    return `slotContext.${category}.${componentNameWithId}`;
  }
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
  }

  return false;
};

const getComponentNameWithId = (props: any, config: HandleProcessConfig) => {
  const { componentType, category, meta } = props;
  if (componentType === "js") {
    if (category === "var") {
      return `var_${meta.id}`;
    } else if (category === "fx") {
      return `fx_${meta.ioProxy.id}`;
    }
  }
  return `${config.getComponentNameByNamespace(meta.def.namespace)}_${meta.id}`;
};

const getNextCode = (props: any, config: HandleProcessConfig) => {
  // 节点执行后的返回值（输出）
  const { nextParam, componentType, category } = props;
  const componentNameWithId = getComponentNameWithId(props, config);

  if (componentType === "js") {
    if (category === "var") {
      return nextParam.length
        ? `const ${componentNameWithId}_${nextParam[0].connectId} = `
        : "";
    } else if (category === "fx") {
      return nextParam.length
        ? `const [${nextParam.map(({ id }: any) => {
            return `${componentNameWithId}_${id}`;
          })}] = `
        : "";
    }
  }
  return nextParam.length
    ? `const {${nextParam
        .map(({ id, connectId }: any) => {
          if (connectId) {
            return `${id}: ${componentNameWithId}_${id}_${connectId}`;
          }
          return `${id}: ${componentNameWithId}_${id}`;
        })
        .join(",")}} = `
    : "";
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
