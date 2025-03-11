import type { ComInfo, DiagramCon } from "../types";
import type { HandleDiagramConfig } from "./handleDiagram";
import type { ComponentTypeAndCategory } from "./utils";
import {
  getComponentTypeAndCategoryByDef,
  validateJsMultipleInputs,
} from "./utils";

type BaseNodeInvocation<T> = Extract<
  ComponentTypeAndCategory,
  { componentType: T }
> & {
  type: "exe"; // 调用类型
  runType: "input" | "autorun";
  eventId: string; // 输入ID
  meta: ComInfo;
  paramSource: Array<ReturnType<HandleProcessConfig["getParamSource"]>>;
  nextParam: Array<{
    id: string;
    title: string;
    /** 单实例组件，例如ui、变量等，需要依赖connectId */
    connectId?: string;
  }>;
};

type NodeInvocation = BaseNodeInvocation<"js"> | BaseNodeInvocation<"ui">;

export type HandleProcessResult = {
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
  nodesInvocation: NodeInvocation[];
  multipleInputsNodes: Record<
    string,
    Array<ReturnType<HandleProcessConfig["getParamSource"]>>
  >;
};

type ParamsSource<T> = Extract<
  ComponentTypeAndCategory,
  { componentType: T }
> & {
  type: "params";
  index: number;
  title: string;
};

type NodeSource<T> = Extract<ComponentTypeAndCategory, { componentType: T }> & {
  type: "node";
  id: string;
  meta: ComInfo;
  connectId?: string;
};

type ValueSource<T> = Extract<
  ComponentTypeAndCategory,
  { componentType: T }
> & {
  type: "value";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
};

interface HandleProcessConfig extends HandleDiagramConfig {
  getParamSource: () =>
    | ParamsSource<"js">
    | ParamsSource<"ui">
    | NodeSource<"js">
    | NodeSource<"ui">
    | ValueSource<"js">;
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
  },
): HandleProcessResult => {
  const {
    nodesDeclaration,
    nodesDeclarationSet,
    nodesInvocation,
    multipleInputsNodes,
  } = result;
  cons.forEach((con) => {
    const comInfo = config.getComInfo(con.to.parent.id);
    const { componentType, category } = getComponentTypeAndCategoryByDef(
      comInfo.def,
    );
    const nextMap: Record<string, DiagramCon[]> = {};
    config.getConAry().forEach((nextCon) => {
      if (
        nextCon.from.parent.id === comInfo.id &&
        (componentType === "js" && category !== "var"
          ? true
          : con.finishPinParentKey === nextCon.startPinParentKey)
      ) {
        if (!nextMap[nextCon.from.id]) {
          nextMap[nextCon.from.id] = [nextCon];
        } else {
          nextMap[nextCon.from.id].push(nextCon);
        }
      }
    });

    console.log("comInfo => ", comInfo);

    if (componentType === "js") {
      if (category === "normal") {
        // 只有普通js才需要声明，其他都是内置特殊处理
        if (!nodesDeclarationSet.has(comInfo.id)) {
          // 去重
          nodesDeclarationSet.add(comInfo.id);
          // 添加节点声明流程
          nodesDeclaration.push({
            type: "declare", // 声明类型
            meta: comInfo,
            props: {
              data: comInfo.model.data,
              inputs: comInfo.inputs,
              outputs: comInfo.outputs,
            },
          });
        }
      }
      const isMultipleInputs = validateJsMultipleInputs(comInfo.inputs[0]);

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

      if (category === "fx") {
        console.log("这里是fx");
        console.log("meta => ", comInfo);
        const { configs } = comInfo.model.data;
        console.log("configs => ", configs);

        const frame = config.getFrameById(comInfo.ioProxy.id);
        const paramSource: ValueSource<"js">[] = [];

        frame.inputs.forEach(({ pinId, type }) => {
          if (type === "config") {
            paramSource.push({
              componentType: "js",
              category: "fx",
              type: "value",
              value: configs[pinId],
            });
          }
        });

        nodesInvocation.push({
          type: "exe", // 调用类型
          meta: comInfo,
          componentType,
          category,
          paramSource: [config.getParamSource(), ...paramSource],
          runType: "input",
          eventId: con.to.id,
          nextParam: Object.entries(nextMap).map(([, cons]) => {
            return {
              id: cons[0].from.id,
              connectId: cons[0].startPinParentKey,
              title: cons[0].from.title,
            };
          }),
        });
      } else {
        // 添加执行流程
        nodesInvocation.push({
          type: "exe", // 调用类型
          meta: comInfo,
          componentType,
          category,
          paramSource: isMultipleInputs
            ? multipleInputsNodes[comInfo.id]
            : [config.getParamSource()],
          runType: "input",
          eventId: con.to.id,
          nextParam: Object.entries(nextMap).map(([, cons]) => {
            return {
              id: cons[0].from.id,
              connectId: cons[0].startPinParentKey,
              title: cons[0].from.title,
            };
          }),
        });
      }
    } else {
      // 添加执行流程
      nodesInvocation.push({
        type: "exe", // 调用类型
        meta: comInfo,
        componentType,
        category,
        paramSource: [config.getParamSource()],
        runType: "input",
        eventId: con.to.id,
        nextParam: Object.entries(nextMap).map(([, cons]) => {
          return {
            id: cons[0].from.id,
            connectId: cons[0].startPinParentKey,
            title: cons[0].from.title,
          };
        }),
      });
    }

    Object.entries(nextMap).forEach(([paramId, cons]) => {
      handleProcess(
        cons,
        {
          ...config,
          getParamSource: () => {
            return {
              type: "node",
              id: paramId,
              meta: comInfo,
              connectId: cons[0].startPinParentKey,
              ...getComponentTypeAndCategoryByDef(comInfo.def),
            };
          },
        },
        result,
      );
    });
  });

  return result;
};

export default handleProcess;
