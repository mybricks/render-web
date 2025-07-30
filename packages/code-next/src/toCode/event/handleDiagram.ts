/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Frame, ComInfo, Diagram, DiagramCon } from "../types";
import type { HandleFrameConfig } from "./handleFrame";
import { getComponentTypeAndCategoryByDef, getConFromSceneById } from "./utils";

export interface HandleDiagramConfig extends HandleFrameConfig {
  getFrame: () => Frame;
  getFrameById: (id: string) => {
    frame: Frame;
    meta: ComInfo | undefined;
  };
}

type HandleDiagramResult = any;

const handleDiagram = (
  diagram: Diagram,
  config: HandleDiagramConfig,
): HandleDiagramResult | undefined => {
  const { id, starter, conAry } = diagram;
  const frame = config.getFrame();
  const frameType = frame.type;

  if (
    diagram.starter.type === "frame" &&
    diagram.starter.frameId === config.getSceneId() &&
    ![
      "globalFx",
      "extension-api",
      "extension-config",
      "extension-bus",
    ].includes(frameType)
  ) {
    const { paramPins, nodesDeclaration, nodesInvocation } =
      handleDiagramWidthMultipleInputs(diagram, config);
    return {
      type: "slot", // 插槽类型
      category: "effect", // 插槽的声明周期
      diagramId: id,
      paramPins,
      title: diagram.title,
      process: {
        nodesDeclaration,
        nodesInvocation,
      },
    };
  } else if (
    diagram.starter.type === "frame" &&
    ["extension-api", "extension-config", "extension-bus"].includes(frameType)
  ) {
    const { paramPins, nodesDeclaration, nodesInvocation, frameOutputs } =
      handleDiagramWidthMultipleInputs(diagram, config);
    return {
      type: frameType, // 插槽类型
      category: "effect", // 插槽的声明周期
      diagramId: id,
      paramPins,
      title: diagram.title,
      process: {
        nodesDeclaration,
        nodesInvocation,
      },
      frameOutputs: frame.outputs.map(({ id, title }) => {
        return {
          id,
          title,
          outputs: frameOutputs[id],
        };
      }),
    };
  } else if (
    diagram.starter.type === "frame" &&
    ["fx", "globalFx"].includes(frameType)
  ) {
    const { paramPins, nodesDeclaration, nodesInvocation, frameOutputs } =
      handleDiagramWidthMultipleInputs(diagram, config);
    const initValues: Record<string, any> = {};

    frame.inputs.forEach((input) => {
      if (input.type === "config") {
        const { pinId, extValues } = input;
        initValues[pinId] = extValues?.config.defaultValue;
      }
    });
    const comInfo = config.getComInfo("");

    return {
      type: "fx", // 插槽类型
      diagramId: id,
      frameId: frame.id,
      parentSlotId: config.getFrameId(),
      parentComId: comInfo?.id,
      paramPins,
      title: diagram.title,
      process: {
        nodesDeclaration,
        nodesInvocation,
      },
      initValues,
      frameOutputs: frame.outputs.map(({ id, title }) => {
        return {
          id,
          title,
          outputs: frameOutputs[id],
        };
      }),
    };
  } else if (diagram.starter.type === "frame" && frameType === "com") {
    const { paramPins, nodesDeclaration, nodesInvocation } =
      handleDiagramWidthMultipleInputs(diagram, config);
    const comInfo = config.getComInfo("");

    return {
      type: "slot", // 插槽类型
      category: "effect", // 插槽的声明周期
      diagramId: id,
      comId: comInfo.id,
      slotId: starter.frameId,
      paramPins,
      title: diagram.title,
      process: {
        nodesDeclaration,
        nodesInvocation,
      },
    };
  } else {
    // 组件事件，只有一个输入
    const startNodes = conAry.filter(
      (con) =>
        con.from.id === starter.pinId && con.from.parent.id === starter.comId,
    );
    const process = handleProcess(startNodes, {
      ...config,
      getParamSource: () => {
        return {
          type: "params", // 来自入参
          id: starter.pinId, // 对应事件id
        };
      },
      getRunType: () => "input",
      getConAry: () => conAry,
    });
    const type = diagram.starter.type;
    const meta = config.getComInfo(starter.comId);
    const result = {
      type, // 类型 com(ui组件) | var(变量)
      diagramId: id,
      meta,
      paramId: starter.pinId,
      title: diagram.title,
      process: {
        nodesDeclaration: process.nodesDeclaration,
        nodesInvocation: process.nodesInvocation,
      },
    };

    if (type === "var") {
      return {
        ...result,
        initValue: meta.model.data.initValue,
      };
    }

    return result;
  }
};

export default handleDiagram;

const handleDiagramWidthMultipleInputs = (
  diagram: Diagram,
  config: HandleDiagramConfig,
) => {
  const { starter, conAry } = diagram;

  const result: HandleProcessResult = {
    nodesDeclaration: [],
    nodesDeclarationSet: new Set(),
    nodesInvocation: [],
    multipleInputsNodes: {},
    frameOutputs: {},
  };

  starter.pinAry.forEach(({ id }) => {
    const startNodes = conAry.filter(
      (con) => con.from.id === id && con.from.parent.id === starter.frameId,
    );
    handleProcess(
      startNodes,
      {
        ...config,
        getParamSource: () => {
          return {
            type: "params", // 来自入参
            id, // 对应事件id
          };
        },
        getRunType: () => "input",
        getConAry: () => conAry,
      },
      result,
    );
  });

  // 自执行组件
  const comsAutoRun = config.getComsAutoRun();

  if (comsAutoRun) {
    comsAutoRun.forEach(({ id }) => {
      handleProcess(
        [
          {
            from: {
              id: "",
              title: "",
              parent: {
                id: "",
              },
            },
            id: "",
            to: {
              id: "",
              title: "自动执行",
              parent: {
                id: id,
                type: "com",
              },
            },
          },
        ],
        {
          ...config,
          getParamSource: () => {
            return {
              type: "params", // 来自入参
              id, // 对应事件id
            };
          },
          getRunType: () => "auto",
          getConAry: () => conAry,
        },
        result,
      );
    });
  }

  return {
    ...result,
    paramPins: starter.pinAry,
  };
};

// 分割

import { validateJsMultipleInputs } from "./utils";

/**
 * 参数类型
 * 1. 来自函数入参
 * 2. 上一个节点的输出
 * 3. 默认值，例如fx
 * 4. 来自插槽的输入
 */

/**
 * 有一个slot context维护的ts
 * SlotContext 页面
 * SlotContext_组件id_插槽id
 *
 * fx和变量都挂在SlotContext下，并在插槽渲染处初始化
 */

type HandleProcessResult = {
  nodesDeclaration: Array<{
    type: "declare"; // 声明类型
    meta: ComInfo;
    props: {
      data: ComInfo["model"]["data"];
      inputs: ComInfo["inputs"];
      outputs: ComInfo["outputs"];
    };
  }>;
  /** 记录声明组件防止重复 */
  nodesDeclarationSet: Set<string>;
  nodesInvocation: any[];
  multipleInputsNodes: Record<string, Array<any>>;
  frameOutputs: Record<string, any>;
};

interface HandleProcessConfig extends HandleDiagramConfig {
  // 获取参数来源信息
  getParamSource: () => any;

  // 获取运行类型，用于判断是否自执行
  getRunType: () => "input" | "auto";

  // 获取所有的节点列表
  getConAry: () => DiagramCon[];
}

const handleProcess = (
  cons: DiagramCon[],
  config: HandleProcessConfig,
  result: HandleProcessResult = {
    nodesDeclaration: [],
    nodesDeclarationSet: new Set(),
    nodesInvocation: [],
    multipleInputsNodes: {},
    frameOutputs: {},
  },
) => {
  const {
    nodesDeclaration,
    nodesDeclarationSet,
    nodesInvocation,
    multipleInputsNodes,
    frameOutputs,
  } = result;
  cons.forEach((con) => {
    if (con.to.parent.type === "frame") {
      const frame = config.getFrame();
      const frameType = frame.type;

      if (
        ["fx", "globalFx", "extension-api", "extension-bus"].includes(frameType)
      ) {
        // 这里说明是卡片的输出，不需要再往下走了
        if (!frameOutputs[con.to.id]) {
          frameOutputs[con.to.id] = [];
        }
        frameOutputs[con.to.id].push(config.getParamSource());
      } else {
        // 非fx，目前认为一定是module
        // [TODO] 观察模块
        // 调用信息
        const invocation = {
          id: con.to.id,
          title: con.to.title,
          meta: {
            parentComId: undefined,
            frameId: undefined,
            // id: undefined,
            id: config.getSceneId(), // 一定是弹窗、页面、模块的ID
          },
          componentType: "ui",
          // category: "module",
          category: config.getSceneType(), // 区分弹窗、页面、模块
          runType: "input",
          nextParam: [],
          paramSource: [config.getParamSource()],
        };
        const scene = config.getScene();
        const rels = Object.entries(scene.pinRels)
          .filter(([key]) => {
            return key.startsWith("_rootFrame_");
          })
          .reduce((rels, [, value]) => {
            value.forEach((v) => rels.add(v));
            return rels;
          }, new Set());

        if (rels.has(con.to.id)) {
          // 关联输出
          nodesInvocation.push({
            ...invocation,
            type: "frameRelOutput",
          });
        } else {
          nodesInvocation.push({
            ...invocation,
            type: "frameOutput",
          });
        }
      }
      return;
    }

    // 节点信息
    const comInfo = config.getComInfo(con.to.parent.id);

    // 节点类型
    const { componentType, category } = getComponentTypeAndCategoryByDef(
      comInfo.def,
    );
    // 下一步
    const nextMap: Record<string, DiagramCon[]> = {};
    config.getConAry().forEach((nextCon) => {
      if (
        (nextCon.from.parent.id === comInfo.id &&
          componentType === "js" &&
          (category !== "var"
            ? true
            : con.finishPinParentKey === nextCon.startPinParentKey)) ||
        (category === "var" && nextCon.from.id === "changed") // 变量changed，变量的监听
      ) {
        if (!nextMap[nextCon.from.id]) {
          nextMap[nextCon.from.id] = [nextCon];
        } else {
          nextMap[nextCon.from.id].push(nextCon);
        }
      }
    });

    // 执行类型
    const runType = config.getRunType();
    // 调用信息
    const invocation = {
      type: "exe", // 调用类型
      id: con.to.id, // 调用输入id
      title: con.to.title, // 调用输入标题
      meta: comInfo, // 组件信息
      componentType, // 组件类型
      category, // 该类型下分类
      runType, // 调输入还是自执行
      // 入参
      nextParam: Object.entries(nextMap).map(([, cons]) => {
        return {
          id: cons[0].from.id,
          connectId: cons[0].startPinParentKey,
          title: cons[0].from.title,
        };
      }),
    };

    if (componentType === "js") {
      if (category === "normal") {
        // 只有普通js才需要声明，其他都是内置特殊处理
        if (!nodesDeclarationSet.has(comInfo.id)) {
          // 去重
          nodesDeclarationSet.add(comInfo.id);
          // 添加节点声明流程
          nodesDeclaration.push({
            type: "declare", // 声明类型
            meta: comInfo, // 组件信息
            props: {
              // 组件所需的参数
              data: comInfo.model.data,
              inputs: comInfo.inputs,
              outputs: comInfo.outputs,
            },
          });
        }
      }
      const isMultipleInputs =
        runType === "input"
          ? validateJsMultipleInputs(comInfo.inputs[0])
          : false;

      if (isMultipleInputs) {
        // 多输入js，需要判断是否输入全部到达
        if (!multipleInputsNodes[comInfo.id]) {
          multipleInputsNodes[comInfo.id] = [];
        }
        const paramIndex = comInfo.inputs.findIndex(
          (inputId) => inputId === con.to.id,
        );
        multipleInputsNodes[comInfo.id][paramIndex] = config.getParamSource();

        if (
          multipleInputsNodes[comInfo.id].filter((p) => p).length !==
          comInfo.inputs.length
        ) {
          // 多输入没有完全到达
          return;
        }
      }

      if (category === "normal" || category === "bus") {
        // 普通js类型，判断下是否多输入
        nodesInvocation.push({
          ...invocation,
          paramSource: isMultipleInputs
            ? multipleInputsNodes[comInfo.id]
            : [config.getParamSource()],
        });
      } else if (category === "var") {
        // 变量
        nodesInvocation.push({
          ...invocation,
          paramSource: [config.getParamSource()],
        });
      } else if (category === "fx") {
        // fx
        const { frame, meta } = config.getFrameById(comInfo.ioProxy.id);
        const paramSource = [config.getParamSource()];
        const configs = comInfo.model.data.configs || {};

        frame.inputs.forEach((input) => {
          if (input.type === "config") {
            // fx配置项不来自输入，需要单独处理
            paramSource.push({
              // 常量，配置的值 -> 默认值
              type: "constant",
              value:
                configs[input.pinId] ||
                input.extValues?.config.defaultValue ||
                undefined,
            });
          }
        });

        nodesInvocation.push({
          ...invocation,
          meta: {
            ...invocation.meta,
            // 每次调用fx都是一个新的组件，需要获取赋予实际作用域
            parentComId: meta?.id,
            // 判断是否全局fx
            global: frame.type === "globalFx" ? true : false,
          },
          paramSource,
        });
      } else if (category === "scene") {
        nodesInvocation.push({
          ...invocation,
          paramSource: [config.getParamSource()],
        });
      } else if (category === "frameOutput") {
        nodesInvocation.push({
          ...invocation,
          paramSource: [config.getParamSource()],
        });
      } else if (category === "frameInput") {
        const conInfo = getConFromSceneById({
          scene: config.getScene(),
          conId: con.id,
        });

        nodesInvocation.push({
          ...invocation,
          frameKey: conInfo.targetFrameKey || conInfo.frameKey,
          paramSource: [config.getParamSource()],
        });
      }
    } else {
      // ui组件
      if (category === "normal") {
        nodesInvocation.push({
          ...invocation,
          paramSource: [config.getParamSource()],
        });
      } else if (category === "module") {
        nodesInvocation.push({
          ...invocation,
          moduleId: comInfo.model.data.definedId,
          paramSource: [config.getParamSource()],
        });
      }
    }

    Object.entries(nextMap).forEach(([paramId, cons]) => {
      handleProcess(
        cons,
        {
          ...config,
          getRunType: () => "input",
          getParamSource: () => {
            const paramSource = {
              type: "node", // 来自节点返回
              id: paramId, // 返回的id
              meta: comInfo,
              connectId:
                runType === "auto" // 全局变量自执行，补充connectId
                  ? cons[0].startPinParentKey
                  : con.finishPinParentKey, // 单实例组件的连接，可能是undefined
              componentType,
              category,
            };
            if (componentType === "ui" && category === "module") {
              return {
                ...paramSource,
                moduleId: comInfo.model.data.definedId,
              };
            } else if (componentType === "js" && category === "fx") {
              const { frame } = config.getFrameById(comInfo.ioProxy.id);

              if (frame.type === "globalFx") {
                // 判断是否全局fx
                return {
                  ...paramSource,
                  meta: {
                    ...paramSource.meta,
                    global: true,
                  },
                };
              }
            }

            return paramSource;
          },
        },
        result,
      );
    });
  });

  return result;
};
