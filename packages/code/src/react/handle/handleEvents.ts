import type { ToBaseJSON, ComDiagram, Component, VarDiagram, Diagram, Slot, FrameDiagram, ConAry } from "@mybricks/render-types";

import { getFunctionName } from "../../utils";

import type { HandleConfig, CodeArray } from "./type";

export type EventType =   
  /** 普通组件 */
  "com" | 
  /** 变量 */
  "var" | 
  /** fx */
  "fx" | 
  /** 页面打开 */
  "page_frame" | 
  /** popup 打开 */
  "popup_frame" |
  /** popup 各类事件 */
  "popup_com";

interface HandleEventsConfig extends HandleConfig {
  /** 事件类型 */
  eventType: EventType;
  /** 
   * 是否在作用域内
   * 如果在作用域内，需要特殊处理
   */
  inScopeSlot?: boolean;
}

interface Next {
  comId: string, 
  pinId: string, 
  title: string, 
  finishPinParentKey?: string, 
  startPinParentKey?: string
  /** 
   * 类型
   * 目前仅用于判断是否fx卡片的输出
   */
  type?: "frame";
}

type Outputs = Array<Next>;

/** 判断是“变量”组件 */
function isVar(namespace?: string) {
  return namespace === "mybricks.core-comlib.var";
}

/** 判断是“fx”组件 */
function isFx(namespace?: string) {
  return namespace === "mybricks.core-comlib.fn";
}

/** 判断是“场景”组件 */
function isScene(namespace?: string) {
  return namespace === "mybricks.core-comlib.scenes";
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

  /** 事件全局上下文信息，函数声明，分支，等 */
  private eventInfo = {
    /** 函数节点声明代码块 */
    functionalDeclarationCode: "",
    /** 函数节点声明map，用于判断是否已创建 */
    functionalDeclarationCodeMap: new Map(),
    /** 分支代码块 */
    branchCode: "",
    /** 需要导入的render-react-hoc包装器 */
    importRenderReactHoc: new Set(),
  }

  /** 收集多输入组件，额外处理 */
  private promiseExcuteComponents = new Set<Component>();

  constructor(private scene: ToBaseJSON, private handleConfig: HandleEventsConfig) {}

  start(diagram: Diagram) {
    const { handleConfig } = this;
    const { eventType } = handleConfig;

    if (eventType === "com") {
      this.handleComEvents(diagram as ComDiagram);
    } else if (eventType === "var") {
      this.handleVarEvents(diagram as VarDiagram);
    } else if (eventType === "fx") {
      this.handleFxEvents(diagram as FrameDiagram);
    } else {
      // TODO: 随意了，反正都在handleComEvents里处理了
      this.handleComEvents(diagram as ComDiagram);
    }

    return this.codeArray;
  }

  /** 生成UI组件的事件代码 */
  handleComEvents(diagram: ComDiagram | VarDiagram | FrameDiagram) {
    const { nextsMap, handleConfig, eventInfo, scene, promiseExcuteComponents } = this;
    const { id, coms, pinProxies } = scene;
    const { filePath, eventType, inScopeSlot } = handleConfig;
    const { title, starter, conAry } = diagram;

    /**
     * ui组件会用到sceneContext
     */
    const importContext = new Set<string>();
    /** 导入变量 */
    const importVariables = new Set<string>();
    /** 记录是否已导入变量 */
    const importVariableMap: {[key: string]: boolean} = {};
    /** 导入fx */
    const importFxs = new Set<string>();
    /** 记录是否已导入fx */
    const importFxMap: {[key: string]: boolean} = {};
    /** 导入scenes 场景状态 */
    const importScenes = new Set<string>();
    /** 记录是否已导入 scenes 场景状态 */
    const importScenesMap: {[key: string]: boolean} = {};
    /** 记录frame的输出 - 例如 fx ....... 后续应该是popup场景 */
    const frameOutputsConAry: ConAry = [];

    conAry.forEach((con) => {
      const { from, to, finishPinParentKey, startPinParentKey } = con
      const { id: outputId, parent: { id: fromComId }, title: fromTitle } = from;
      const { id: inputId, parent: { id: toComId, type: toType }, title: toTitle } = to;
      const nexts = nextsMap[fromComId] ||= {};
      const outputs = nexts[outputId] ||= [];

      /** 作用域插槽等输出，不再向下执行 */
      if (toType === "frame") {
        frameOutputsConAry.push(con);
        outputs.push({
          comId: toComId,
          pinId: inputId,
          title: toTitle,
          finishPinParentKey,
          startPinParentKey,
          type: "frame"
        });
        return
      }

      const component = coms[toComId];
      const { def } = component;
      const { rtType, namespace } = def;

      /** ui组件 */
      if (!rtType) {
        importContext.add("sceneContext");
      }

      const { frameId, parentComId } = component;

      if (isVar(namespace)) {
        /** 导入变量组件 */
        const key = `${parentComId}-${frameId}`;
        if (parentComId && frameId && !importVariableMap[key]) {
          /** 区分作用域 */
          importVariableMap[key] = true;
          /** 查找路径 */
          const componentTreePathArray = getComponentTreePathArray(scene.slot, {comId: parentComId, slotId: frameId});

          importVariables.add(`import variable_${parentComId}_${frameId} from "@/slots/slot_${id}/${componentTreePathArray?.map(({comId, slotId}) => {
            const component = coms[comId];
            return `${component.def.namespace}_${comId}/slots/${slotId}`;
          }).join("/")}/variable";`);
        } else {
          importVariables.add(`import variable_${id} from "@/slots/slot_${id}/variable";`)
        }
      } else if (isFx(namespace)) {
        /** 导入fx组件 */
        /** 查找对应的fx id */
        const fxId = pinProxies[toComId + '-' + inputId].frameId;
        /** fx组件 */
        const key = `${parentComId}-${frameId}`;
        if (parentComId && frameId && !importFxMap[key]) {
          /** 区分作用域 */
          importFxMap[key] = true;
           /** 查找路径 */
          const componentTreePathArray = getComponentTreePathArray(scene.slot, {comId: parentComId, slotId: frameId});
          
          importFxs.add(`import fx_${fxId} from "@/slots/slot_${id}/${componentTreePathArray?.map(({comId, slotId}) => {
            const component = coms[comId];
            return `${component.def.namespace}_${comId}/slots/${slotId}`;
          }).join("/")}/fx/${fxId}";`);
        } else {
          importFxs.add(`import fx_${fxId} from "@/slots/slot_${id}/fx/${fxId}";`)
        }
      } else if (isScene(namespace)) {
        /** 导入场景状态 */
        const sceneId = component.model.data._sceneId;
        if (!importScenesMap[sceneId]) {
          importScenesMap[sceneId] = true;
          importScenes.add(`import { sceneContext as sceneContext_${sceneId} } from "@/slots/slot_${sceneId}";`);
        }
      }

      outputs.push({
        comId: toComId,
        pinId: inputId,
        title: toTitle,
        finishPinParentKey,
        startPinParentKey
      })
    });

    /** 入参 */
    let params = "value: unknown";
    /** 函数体 */
    let nextsCode = "";
    /** 类型声明 */
    let typeDeclarationCode = "";

    if (eventType === "fx") {
      /** 目前只有fx有配置项，特殊处理一下 */
      /** fx需要使用fx包装器 */
      eventInfo.importRenderReactHoc.add("fxWrapper");
      /** 后面做作用域插槽的时候看看是否要区分下fx和frame？ */
      const { frameId, pinAry } = starter as FrameDiagram['starter'];
      /** 配置项数量，目前用于设置config变量名 */
      let configSuffix = 0;
      /** 配置项入参 */
      let configPins: Array<{ id: string, title: string, param: string }> = [];
      /** 将config配置提前，优先执行config */
      pinAry.sort((p, c) => {
        const pType = p.type;
        const cType = c.type;
        if (pType === 'config' && cType !== 'config') {
          return -1; // 若 p 是 config 且 c 不是，p 应排在前面，返回 -1
        } else if (pType !== 'config' && cType === 'config') {
          return 1; // 若 c 是 config 且 p 不是，c 应排在前面，返回 1
        }
        return 0; // 类型相同，保持原顺序
      }).forEach(({ id, title, type }) => {
        const outputs = nextsMap[frameId]?.[id];
        let valueCode = "value";

        if (type === "config") {
          /** config配置项作为第二个入参 */
          valueCode = `config${configSuffix++}`;
          configPins.push({id, title, param: valueCode})
        }
        nextsCode = nextsCode + (outputs ? this.handleNexts(outputs, { valueCode }) : "");
      })

      /** 拼入参的配置项 */
      if (configPins.length) {
        params = params + `,{${configPins.reduce((p, c) => `${p}${c.id}: ${c.param},`, "")}} : {${configPins.reduce((p, c) => `${p}\n/** ${c.title} */\n${c.id}: unknown;`, "")}}`;
      }

      /** 此类this上下文都用Context */
      // typeDeclarationCode = `
      //   type Context = Record<string, unknown>${frameOutputsConAry.length ? ` & {
      //     ${frameOutputsConAry.map(({to}) => {
      //       return `
      //         /** ${to.title} */
      //         ${to.id}: (value: unknown) => void;
      //       `;
      //     }).join("")}
      //   }` : ""};
      // `

      nextsCode = `/** ${title} */
        export default fxWrapper(async function (this: Context, ${params}${inScopeSlot ? ", scopeId: string" : ""}) {
          ${nextsCode}
        });
      `;
    } else if (eventType === "page_frame") {
      /** 
       * 页面 主卡片
       * 只有一个输入，直接取第一个
       */
      const { frameId, pinAry } = starter as FrameDiagram['starter'];
      const { id, title } = pinAry[0];
      const outputs = nextsMap[frameId]?.[id];
      nextsCode = outputs ? this.handleNexts(outputs, { valueCode: "value" }) : "";
      nextsCode = `/** ${title} */
        export default async function (${params}${inScopeSlot ? ", scopeId: string" : ""}) {
          ${nextsCode}
        }
      `;
    } else if (eventType === "popup_frame") {
      /** 
       * 页面 主卡片
       * 只有一个输入，直接取第一个
       */
      const { frameId, pinAry } = starter as FrameDiagram['starter'];
      const { id, title } = pinAry[0];
      const outputs = nextsMap[frameId]?.[id];
      nextsCode = outputs ? this.handleNexts(outputs, { valueCode: "value" }) : "";
      /** 导入场景状态 */
      const sceneId = frameId;
      if (!importScenesMap[sceneId]) {
        importScenesMap[sceneId] = true;
        importScenes.add(`import { sceneContext as sceneContext_${sceneId} } from "@/slots/slot_${sceneId}";`);
      }
      nextsCode = `/** ${title} */
        async function ${id}(this: Context, ${params}${inScopeSlot ? ", scopeId: string" : ""}) {
          ${nextsCode}
        }

        export default function (value: unknown) {
          sceneContext_${sceneId}.wrapper(${id})(value);
        }
      `;
    } else if (eventType === "popup_com") {
      /**
       * 组件事件卡片，正常取
       */
      const { comId, pinId } = starter as ComDiagram['starter'];
      const outputs = nextsMap[comId]?.[pinId];
      nextsCode = outputs ? this.handleNexts(outputs, { valueCode: "value" }) : "";
      /** 导入场景状态 */
      const sceneId = id;
      if (!importScenesMap[sceneId]) {
        importScenesMap[sceneId] = true;
        importScenes.add(`import { sceneContext as sceneContext_${sceneId} } from "@/slots/slot_${sceneId}";`);
      }
      nextsCode = `/** ${title} */
        async function ${pinId}(this: Context, ${params}${inScopeSlot ? ", scopeId: string" : ""}) {
          ${nextsCode}
        }

        export default function (value: unknown) {
          sceneContext_${sceneId}.wrapper(${pinId})(value);
        }
      `;
    } else {
      /**
       * 组件事件卡片，正常取
       */
      const { comId, pinId } = starter as ComDiagram['starter'];
      const outputs = nextsMap[comId]?.[pinId];
      nextsCode = outputs ? this.handleNexts(outputs, { valueCode: "value" }) : "";
      nextsCode = `/** ${title} */
        export default async function (${params}${inScopeSlot ? ", scopeId: string" : ""}) {
          ${nextsCode}
        }
      `;
    }

    Array.from(promiseExcuteComponents).forEach((component) => {
      this.handlePromiseExcute(component);
      if (component.inputs.length > 1) {
        /** 如果有多输入的话，引入 _ */
        eventInfo.importRenderReactHoc.add("_");
      }
    })

    if (nextsCode.indexOf("this: Context") !== -1) {
      /** 
       * 此类this上下文都用Context，应该是全部通用的
       * 前提是用到了this: Context
       */
      typeDeclarationCode = `
        type Context = Record<string, unknown>${frameOutputsConAry.length ? ` & {
          ${frameOutputsConAry.map(({to}) => {
            return `
              /** ${to.title} */
              ${to.id}: (value: unknown) => void;
            `;
          }).join("")}
        }` : ""};
      `;
    }

    this.codeArray.push({
      code: `${// 导入变量
        importVariables.size ? Array.from(importVariables).join("") : ""}
        ${// 导入场景状态
          importScenes.size ? Array.from(importScenes).join("") : ""}
        ${// 导入fx
          importFxs.size ? Array.from(importFxs).join("") : ""}
        ${// 导入ui组件的事件
          importContext.size ? `import { ${Array.from(importContext).join(", ")} } from "@/slots/slot_${id}";` : ""}
        ${// 导入各类包装器
          eventInfo.importRenderReactHoc.size ? `import { ${Array.from(eventInfo.importRenderReactHoc)} } from "@mybricks/render-react-hoc";` : ""}

        ${// 写入函数声明代码块
          eventInfo.functionalDeclarationCode}

        ${// 写入分支代码块
          eventInfo.branchCode}

        ${// 写入类型定义
          typeDeclarationCode}

        ${// 写入事件函数代码
          nextsCode}
      `,
      filePath: `${filePath}/index.ts`
    })
  }

  /** 生成变量组件的事件代码 */
  handleVarEvents(diagram: VarDiagram) {
    // 目前看变量组件和UI组件的事件处理逻辑是一致的，再观察下
    this.handleComEvents(diagram);
  }

  /** 生成fx卡片代码 */
  handleFxEvents(diagram: FrameDiagram) {
    // 这块生成应该都可以统一处理，内部可能有细微差异，目前靠类型判断写一块了
    this.handleComEvents(diagram);
  }

  /** 生成下一步代码 */
  handleNexts(
    outputs: Outputs,
    /** 上下文入参字符串 */
    { valueCode }: { valueCode: string }  
  ): string {
    const { nextsMap, scene, promiseExcuteComponents, handleConfig } = this;
    const { eventType, inScopeSlot } = handleConfig;
    /**
     * 如果是fx类型的卡片，开分支需要添加.bind(this)
     */
    const bindCode = ["popup_com", "popup_frame", "fx"].includes(eventType) ? ".bind(this)" : "";
    const { id, coms, pinRels, pinProxies } = scene;
    if (outputs.length === 1) {
      /** 输出只有一个，直接await向下执行 */
      const output = outputs[0]

      if (output.type === "frame") {
        return `
        /** ${output.title} */
        this.${output.pinId}(${valueCode});`
      }

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
          return `/** ${component.title} - ${title} 6*/
            sceneContext.getComponent("${comId}").${pinId}(${valueCode});
          `
        } else {
          /** TODO: 这里看之后是否需要考虑到没有输出的情况？ */
          if (rels.length < 2) {
            const outputId = rels[0];
            /** 非单实例的节点需要使用startPinParentKey和finishPinParentKey来进行对接 */
            const nextOutputs = nextsMap[comId]?.[outputId]?.filter((next) => matchesConnections(next, finishPinParentKey));
            if (!nextOutputs?.length) {
              console.log(inScopeSlot ? "在作用域内" : "不在作用域内")
              return `/** ${component.title} - ${title} 5*/
                sceneContext.getComponent("${comId}").${pinId}(${valueCode});
              `
            } else {
              return `/** ${component.title} - ${title} 4*/
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
                excuteNextWrapper = excuteNextWrapper + `${wrapperName}(${nextFunctionName}${bindCode});`;
                this.handleWrapper(nextOutputs, { functionName: nextFunctionName });
              }
            });

            if (nextWrapper) {
              /** 有下一步 */
              return `/** ${component.title} - ${title} 1*/
                const { ${nextWrapper} } = sceneContext.getComponent("${comId}").${pinId}(${valueCode});
                ${excuteNextWrapper}
              `
            } else {
              /** 没有下一步 */
              return `/** ${component.title} - ${title} 2*/
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

        /** 生成变量名 */
        const variableName = `variable_${component.parentComId ? `${component.parentComId}_${component.frameId}` : id}`

        if (!nextOutputs?.length) {
          if (pinId === "set") {
            /** 除了set就是get，get如果没有下一步就不用写出来了 */
            return `/** ${component.title} - ${title} */
              ${variableName}["${comId}"].set(${valueCode});
            `;
          }
        } else {
          if (pinId === "set") {
            return `/** ${component.title} - ${title} */
              await ${variableName}["${comId}"].set(${valueCode});
            
              ${this.handleNexts(nextOutputs, { valueCode })}
            `;
          } else if (pinId === "get") {
            /** TODO: 后续优化点，这里目前是直接修改的入参value，不太符合编码规范 */
            return `/** ${component.title} - ${title} */
              value = ${variableName}["${comId}"].get();

              ${this.handleNexts(nextOutputs, { valueCode: "value" })}
            `
          }
        }
      } else if (isFx(component.def.namespace)) {
        /** FX 特殊处理 */
        const proxyDescription  = pinProxies[`${output.comId}-${output.pinId}`];
        const nextOutputs = nextsMap[comId]
        const configs = component.model.data.configs;

        if (!nextOutputs) {
          /** 执行到这里就结束了 */
          return `/** ${component.title} */
            fx_${proxyDescription.frameId}(${valueCode}${configs ? `, ${JSON.stringify(configs)}` : ""})
          `
        } else {
          /** 继续向下执行 - fx目前无论单输出还是多输出都作为多输出使用 */
          const outputIds = Object.keys(nextOutputs);
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
            excuteNextWrapper = excuteNextWrapper + `${wrapperName}(${nextFunctionName}${bindCode});`;
            this.handleWrapper(nextOutputs[outputId], { functionName: nextFunctionName });
          })
          
          /** 多个输出 */
          return `/** ${component.title} */
            const { ${nextWrapper} } = fx_${proxyDescription.frameId}(${valueCode}${configs ? `, ${JSON.stringify(configs)}` : ""})
            ${excuteNextWrapper}
          `;
        }
      } else if (isScene(component.def.namespace)) {
        const nextOutputs = nextsMap[comId]
        /** 触发的场景ID */
        const sceneId = component.model.data._sceneId;

        if (!nextOutputs) {
          /** 执行到这里就结束了 */
          return `sceneContext_${sceneId}.open(${valueCode});`;
        } else {
          /** 继续向下执行 - fx目前无论单输出还是多输出都作为多输出使用 */
          const outputIds = Object.keys(nextOutputs);
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
            excuteNextWrapper = excuteNextWrapper + `${wrapperName}(${nextFunctionName}${bindCode});`;
            this.handleWrapper(nextOutputs[outputId], { functionName: nextFunctionName });
          })
          
          /** 多个输出 */
          return `/** ${component.title} */
            const { ${nextWrapper} } = sceneContext_${sceneId}.open(${valueCode});
            ${excuteNextWrapper}
          `;
        }
      }

      

      const nextOutputs = nextsMap[comId]
      const nextFunctionName = getFunctionName({ namespace: component.def.namespace, id: comId });
      
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
          excute_${nextFunctionName}${bindCode}(${valueCode});
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
            excuteNextWrapper = excuteNextWrapper + `${wrapperName}(${nextFunctionName}${bindCode});`;
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
    const { eventInfo } = this;
    if (!eventInfo.functionalDeclarationCodeMap.has(functionName)) {
      /** 防止重复添加 */
      eventInfo.functionalDeclarationCodeMap.set(functionName, true);
      eventInfo.importRenderReactHoc.add(wrapper);
      eventInfo.functionalDeclarationCode = eventInfo.functionalDeclarationCode + `
        /** ${component.title} - ${component.id} */
        function ${functionName}(value: unknown) {
          return ${wrapper}({
            data: ${JSON.stringify(component.model.data)},
            component: "${component.def.namespace}",
          })(value);
        }      
      `;
    }
  }

  /** 开分支 */
  handleWrapper(outputs: Outputs, { functionName }: { functionName: string }) {
    const { eventInfo, handleConfig } = this;
    const { eventType } = handleConfig;
    /**
     * 如果是fx类型的卡片，开分支需要添加this变量
     */
    const thisContext = ["popup_com", "popup_frame", "fx"].includes(eventType) ? "this: Context, " : "";
    eventInfo.branchCode = eventInfo.branchCode + `
      async function ${functionName}(${thisContext}value: unknown) {
        ${this.handleNexts(outputs, { valueCode: "value" })}
      }
    `;
  }

  /** 多输入代码生成 */
  handlePromiseExcute(component: Component) {
    const { eventInfo, nextsMap } = this
    const functionName = getFunctionName({ namespace: component.def.namespace, id: component.id });
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
    eventInfo.branchCode = eventInfo.branchCode + `
      const excute_${functionName} = ${functionName}({${outputsCode}});
    `;
  }
}

/** 获取组件位置 */
function getComponentTreePathArray(slot: Slot, { comId, slotId }: { comId: string, slotId: string}, componentTreePathArray: Array<{comId: string, slotId: string}> = []) {
  /** 查询到组件的标识 */
  let success = false;

  slot.comAry.find((component) => {
    if (component.id === comId) {
      success = true
      componentTreePathArray.unshift({comId: component.id, slotId})
      return true
    }
    
    const slots = component.slots;
    if (slots) {
      Object.keys(slots).find((slotId) => {
        success = !!getComponentTreePathArray(slots[slotId], {comId, slotId}, componentTreePathArray);
        if (success) {
          componentTreePathArray.unshift({comId: component.id, slotId})
        }
        return success
      })
    }
  })

  return success ? componentTreePathArray : null;
}
