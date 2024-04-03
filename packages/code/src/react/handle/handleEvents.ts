import { isNumber, convertToUnderscore, convertCamelToHyphen, getSlotStyle } from "@mybricks/render-utils";

import type { ToBaseJSON, ComDiagram, Component, VarDiagram, Diagram } from "@mybricks/render-types";

import type { HandleConfig, CodeArray } from "./type";

interface HandleEventsConfig extends HandleConfig {}

interface Next {
  comId: string, 
  pinId: string, 
  title: string, 
  finishPinParentKey?: string, 
  startPinParentKey?: string
}

type Outputs = Array<Next>;

/** 
 * 卡片类型
 *  - com ui组件事件
 *  - var 变量
 */
type EventType = "com" | "var";

/** 判断是“变量”组件 */
function isVar(namespace?: string) {
  return namespace === "mybricks.core-comlib.var";
}

/** 
 * 连接上下输入输出
 * 上一个节点的finishPinParentKey === 下一个节点的startPinParentKey
 */
function matchesConnections({ startPinParentKey }: any, finishPinParentKey?: string) {
  return (startPinParentKey && finishPinParentKey) && (startPinParentKey === finishPinParentKey);
}

export class HandleEvents {
  /** 存储生成的代码字符串和写入文件路径 */
  codeArray: CodeArray = [];

  /** 组件ID - outputID - outputs 映射关系 */
  private nextsMap: {
    /** 组件ID */
    [key: string]: {
      /** outputID */
      [key: string]: Array<any>
    }
  } = {}

  /** 需要导入的组件和运行时代码 */
  private eventInfo = {
    /** 导入的文件 */
    import: new Set(),
    /** 分支代码块 */
    runtime: ""
  }

  /** 收集多输入组件，额外处理 */
  private promiseExcuteComponents = new Set<Component>();

  constructor(private scene: ToBaseJSON, private handleConfig: HandleEventsConfig) {}

  start(diagram: Diagram) {
    const { starter } = diagram;
    const { type } = starter;
    if (type === "com") {
      this.handleComEvents(diagram as ComDiagram);
    } else if (type === "var") {
      this.handleVarEvents(diagram as VarDiagram);
    }

    return this.codeArray;
  }

  /** 生成UI组件的事件代码 */
  handleComEvents(diagram: ComDiagram) {
    const { nextsMap, handleConfig, eventInfo, scene, promiseExcuteComponents } = this;
    const { id, coms } = scene;
    const { filePath } = handleConfig;
    const { starter, conAry } = diagram;
    const { comId, pinId } = starter;

    /**
     * ui组件会用到sceneContext
     * 变量会用到variableMap
     */
    const importContext = new Set<string>();

    conAry.forEach((con) => {
      const { from, to, finishPinParentKey, startPinParentKey } = con
      const { id: outputId, parent: { id: fromComId }, title: fromTitle } = from;
      const { id: inputId, parent: { id: toComId }, title: toTitle } = to;

      /** ui组件 */
      if (!importContext.has("sceneContext") && !coms[toComId].def.rtType) {
        importContext.add("sceneContext");
      }
      /** 变量组件 */
      if (!importContext.has("variableMap") && isVar(coms[toComId].def.namespace)) {
        importContext.add("variableMap");
      }

      const nexts = nextsMap[fromComId] ||= {};
      const outputs = nexts[outputId] ||= [];

      outputs.push({
        comId: toComId,
        pinId: inputId,
        title: toTitle,
        finishPinParentKey,
        startPinParentKey
      })
    });
    const outputs = nextsMap[comId][pinId];
    const nextsCode = this.handleNexts(outputs, { valueCode: "value" });
    const promiseExcuteComponentsArray = Array.from(promiseExcuteComponents);
    let importCode = "";
    if (promiseExcuteComponentsArray.length) {
      let useEmpty = false;
      promiseExcuteComponentsArray.forEach((component) => {
        this.handlePromiseExcute(component);
        if (component.inputs.length > 1) {
          useEmpty = true;
        }
      })
      /** 如果有多输入的话，引入 _ */
      if (useEmpty) {
        importCode = 'import { _ } from "@mybricks/render-react-hoc";';
      }
    }

    importCode = importCode + Array.from(eventInfo.import).join("\n");

    this.codeArray.push({
      code: `${importContext.size ? `import { ${Array.from(importContext).join(", ")} } from "@/slots/slot_${id}";` : ""}
        ${importCode}

        ${eventInfo.runtime}

        export default async function ${pinId}(value: unknown) {
          ${nextsCode}
        }
      `,
      filePath: `${filePath}/index.ts`
    })
  }

  /** 生成变量组件的事件代码 */
  handleVarEvents(diagram: VarDiagram) {
    // TODO: console.log(diagram, "开始计算变量组件代码")
  }

  /** 生成下一步代码 */
  handleNexts(
    outputs: Outputs,
    /** 上下文入参字符串 */
    { valueCode }: { valueCode: string }  
  ): string {
    const { nextsMap, scene, eventInfo, promiseExcuteComponents } = this;
    const { coms, pinRels } = scene;
    
    if (outputs.length === 1) {
      /** 输出只有一个，直接await向下执行 */
      const output = outputs[0]
      const { pinId, comId, title, finishPinParentKey } = output;
      const component = coms[comId];

      if (!component.def.rtType) {
        /** 
         * 非单实例的节点需要执行到这个分支
         * 
         * 没有rtType 说明是ui组件
         */
        const rels = pinRels[`${comId}-${pinId}`];
        if (!rels) {
          return `/** ${component.title} - ${title} */
            sceneContext.getComponent("${comId}").${pinId}(${valueCode});
          `
        } else {
          /** TODO: 这里看之后是否需要考虑到没有输出的情况？ */
          if (rels.length < 2) {
            const outputId = rels[0];
            /** 非单实例的节点需要使用startPinParentKey和finishPinParentKey来进行对接 */
            const nextOutputs = nextsMap[comId]?.[outputId]?.filter((next) => matchesConnections(next, finishPinParentKey));
            if (!nextOutputs?.length) {
              return `/** ${component.title} - ${title} */
                sceneContext.getComponent("${comId}").${pinId}(${valueCode});
              `
            } else {
              return `/** ${component.title} - ${title} */
                const ${pinId}_${comId} = await sceneContext.getComponent("${comId}").${pinId}(${valueCode});
                ${this.handleNexts(nextOutputs, { valueCode: `${pinId}_${comId}` })}
              `;
            }
          } else {
            /** 从多输出解构出来的包装器 */
            let nextWrapper = "";
            /** 执行包装器 */
            let excuteNextWrapper = "";

            rels.forEach((outputId, index) => {
              /** 非单实例的节点需要使用startPinParentKey和finishPinParentKey来进行对接 */
              const nextOutputs = nextsMap[comId]?.[outputId]?.filter((next) => matchesConnections(next, finishPinParentKey))
              if (nextOutputs?.length) {
                const wrapperName = `${outputId}_${comId}`;
                nextWrapper = nextWrapper + `${outputId}: ${wrapperName},`;
                const nextFunctionName = `${wrapperName}_next`;
                excuteNextWrapper = excuteNextWrapper + `${wrapperName}(${nextFunctionName});`;
                this.handleWrapper(nextOutputs, { functionName: nextFunctionName });
              }
            });

            if (nextWrapper) {
              /** 有下一步 */
              return `/** ${component.title} - ${title} */
                const { ${nextWrapper} } = sceneContext.getComponent("${comId}").${pinId}(${valueCode});
                ${excuteNextWrapper}
              `
            } else {
              /** 没有下一步 */
              return `/** ${component.title} - ${title} */
                sceneContext.getComponent("${comId}").${pinId}(${valueCode});
              `
            }
          }
        }
      } else if (isVar(component.def.namespace)) {
        /** 
         * 变量组件特殊处理
         * 相当于将变量组件翻译成代码
         */
        /** 变量一定有下一步 */
        const outputId = "return"; // 本来应该从 pinRels[`${comId}-${pinId}`][0] 获取，既然特殊处理，就特殊到底咯
        /** 非单实例的节点需要使用startPinParentKey和finishPinParentKey来进行对接 */
        const nextOutputs = nextsMap[comId]?.[outputId]?.filter((next) => matchesConnections(next, finishPinParentKey))
        if (!nextOutputs?.length) {
          return `/** ${component.title} - ${title} */
            variableMap["${comId}"] = ${valueCode};
          `;
        } else {
          return `/** ${component.title} - ${title} */
            variableMap["${comId}"] = ${valueCode};
            ${this.handleNexts(nextOutputs, { valueCode })}
          `;
        }
      }

      

      const nextOutputs = nextsMap[comId]
      const nextFunctionName = `${convertToUnderscore(component.def.namespace)}_${comId}`;
      eventInfo.import.add(`import ${nextFunctionName} from "./${nextFunctionName}";`)
      /** 
       * 是否多输入
       * - 计算组件只有多输入和非多输入，不存在共存的情况
       */
      const isPromiseInput = component.inputs[0].split(".")[1];
      /** 是否只有一个输出 */
      const isSingleOutput = component.outputs.length === 1;
      let wrapper = "";
      if (isPromiseInput) {
        promiseExcuteComponents.add(component);
        /** 
         * 多输入已数组的形式，空的部分使用 _ 代替，数组长度代表多输入个数
         * @example
         * ['a', _, 'c']
         */
        valueCode = `[${component.inputs.map((inputId) => inputId === output.pinId ? valueCode : "_").join(", ")}]`
        if (isSingleOutput) {
          /** 多输入单输出 */
          wrapper = "jsComponentMultipleInputsWrapper";
        } else {
          /** 多输入多输出 TODO: 多输入组件不用区分单输出还是多输出？ */
          wrapper = "jsComponentMultipleInputsWrapper";
        }
      } else {
        if (isSingleOutput) {
          /** 单输入单输出 */
          wrapper = "jsComponentSingleOutputWrapper";
        } else {
          /** 单输入多输出 */
          wrapper = "jsComponentMultipleOutputsWrapper";
        }
      }

      this.handleExcuteComponent(component, {
        functionName: nextFunctionName,
        wrapper
      });

      if (isPromiseInput) {
        /** 执行多输入的excute函数 */
        return `/** ${component.title} - ${title} - ${pinId} */
          excute_${nextFunctionName}(${valueCode});
        `
      }

      if (!nextOutputs) {
        /** 执行到这里就结束了 */
        return `/** ${component.title} - ${title} - ${pinId} */
          ${nextFunctionName}(${valueCode});
        `
      } else {
        /** 继续向下执行 */
        const outputIds = Object.keys(nextOutputs);

        if (component.outputs.length === 1) {
          /** 一个输出 */
          const outputId = outputIds[0];
          return `/** ${component.title} - ${title} - ${pinId} */
            const ${outputId}_${comId} = await ${nextFunctionName}(${valueCode});
            ${this.handleNexts(nextOutputs[outputId], { valueCode: `${outputId}_${comId}` })}
          `
        } else {
          const outputIdsLastIndex = outputIds.length - 1;
          /** 从多输出解构出来的包装器 */
          let nextWrapper = "";
          /** 执行包装器 */
          let excuteNextWrapper = "";

          outputIds.forEach((outputId, index) => {
            const wrapperName = `${outputId}_${comId}`;
            /** 这里需要重新命名 */
            nextWrapper = nextWrapper + `${outputId}: ${wrapperName}${index === outputIdsLastIndex ? "": ","}`;
            const nextFunctionName = `${wrapperName}_next`;
            excuteNextWrapper = excuteNextWrapper + `${wrapperName}(${nextFunctionName});`;
            this.handleWrapper(nextOutputs[outputId], { functionName: nextFunctionName });
          })
          
          /** 多个输出 */
          return `/** ${component.title} - ${title} - ${pinId} */
            const { ${nextWrapper} } = ${nextFunctionName}(${valueCode});
            ${excuteNextWrapper}
          `
        }
      }
    } else {
      /** 一个输出口有多个输出，需要拆分支 */
      /** 从多输出解构出来的包装器 */
      let nextWrapper = "";
      /** 执行包装器 */
      let excuteNextWrapper = "";

      outputs.forEach((output, index) => {
        nextWrapper = nextWrapper + `const next${index} = async (value: unknown) => {
          ${this.handleNexts([output], { valueCode: "value" })}
        }\n`
        excuteNextWrapper = excuteNextWrapper + `next${index}(${valueCode});`
      })
      return `${nextWrapper}

        ${excuteNextWrapper}
      `
    }
  }

  /** 生成计算组件代码 */
  handleExcuteComponent(component: Component, { functionName, wrapper }: { functionName: string, wrapper: string }) {
    const { handleConfig } = this;
    this.codeArray.push({
      code: `import globalContext from "@/globalContext";
        import { ${wrapper} } from "@mybricks/render-react-hoc";

        const component = globalContext.getComponent(
          "${component.def.namespace}",
        );

        /** ${component.title} - ${component.id} */
        export default function (value: unknown) {
          return ${wrapper}({
            data: ${JSON.stringify(component.model.data)},
            component,
          })(value);
        }      
      `,
      filePath: `${handleConfig.filePath}/${functionName}.ts`,
    })
  }

  /** 开分支 */
  handleWrapper(outputs: Outputs, { functionName }: { functionName: string }) {
    const { eventInfo } = this;
    eventInfo.runtime = eventInfo.runtime + `async function ${functionName}(value: unknown) {
      ${this.handleNexts(outputs, { valueCode: "value" })}
    }`
  }

  /** 多输入代码生成 */
  handlePromiseExcute(component: Component) {
    const { eventInfo, scene, nextsMap } = this
    const functionName = `${convertToUnderscore(component.def.namespace)}_${component.id}`;
    let outputsCode: string = "";

    component.outputs.forEach((outputId) => {
      const outputs = nextsMap[component.id]?.[outputId];
      if (outputs) {
        const functionName = `${outputId}_${component.id}_next`;
        this.handleWrapper(outputs, { functionName })
        outputsCode = outputsCode + `${outputId}: ${functionName},`
      } else {
        outputsCode = outputsCode + `${outputId}: () => {},`
      }
    })

    eventInfo.runtime = eventInfo.runtime + `const excute_${functionName} = ${functionName}({${outputsCode}});`;
  }
}
