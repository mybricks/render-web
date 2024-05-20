import { isNumber, convertToUnderscore, convertCamelToHyphen, getSlotStyle, getComponentStyle } from "@mybricks/render-utils";
import type { Frame, Slot, SlotStyle, ToBaseJSON, DomNode, ComponentNode, ComDiagram, Component, Diagram } from "@mybricks/render-types";

import { HandleEvents, EventType } from "./handleEvents";

import { getFunctionName } from "../../utils";

import type { HandleConfig, CodeArray } from "./type";

interface HandleCanvasConfig extends HandleConfig {
  /** 外包装代码，目前用于智能布局对组件dom的一层包装 */
  wrapperCode: string;
  /** 是否场景主入口，主入口需要将场景context向外导出 */
  // root?: boolean;
  /** 没有parentId，认为是主入口，不是组件插槽 */
  parentId?: string;
  /** 逻辑编排卡片信息 */
  frame: Frame;
}

/** 
 * 通用画布处理，场景、模块
 */
export function handleCanvas({ scene, frame }: { scene: ToBaseJSON, frame: Frame}) {
  const canvas = new HandleCanvas(scene);
  return canvas.start(frame);
}

class HandleCanvas {
  /** 存储生成的代码字符串和写入文件路径 */
  codeArray: CodeArray = [];

  /** 画布代码 - filePath 对应代码 */
  slotInfoMap: {
    [key: string]: {
      /** 导入插槽内组件、事件 */
      import: string;
      /** 执行插槽内组件 */
      runtime: string;
    }
  } = {};

  constructor(private scene: ToBaseJSON) {}

  start(frame: Frame) {
    // TODO: 应该存在问题
    // Object.entries(this.scene.coms).forEach(([key, com]) => {
    //   console.log(com.id, "原先")
    //   com.id = uuid();
    //   console.log(com.id, "处理后")
    // })
    this.handleSlot(this.scene.slot, { filePath: "", wrapperCode: "", frame })

    return this.codeArray;
  }

  /** 处理Slot */
  handleSlot(slot: Slot, handleConfig: HandleCanvasConfig) {
    const { scene } = this;
    const { coms, type } = scene;
    const { filePath, parentId, frame } = handleConfig;
    /** 根节点，即画布 */
    const root = !parentId;
    const { diagrams, frames } = frame;
    const slotInfo = this.slotInfoMap[filePath] = {
      import: "",
      runtime: ""
    };
    const { style, comAry, layoutTemplate } = slot;
    if (style.layout === "smart") {
      /** 智能布局，多处理一层 */
      this.handleCompoents(layoutTemplate, handleConfig);
    } else {
      /** 非智能布局 */
      this.handleCompoents(comAry, handleConfig);
    }

    /** 
     * 需要导入的插槽events，当前认为一定有个open输入项
     * TODO:
     *  1. 没有输入项目的情况，pinAry是空的
     *  2. 是否要支持“起始组件” - js-autorun
     */
    // const importRootEvents = new Set();

    /** 需要导入的react hooks */
    const importReactHooks = new Set();

    /** 
     * dom挂在后执行的代码，例如场景的打开，作用域插槽的输入
     * 
     * 场景和作用域插槽都需要
     */
    let useEffectCode = "";

    /**
     * 用于创建唯一ID
     * 
     * 作用域插槽需要
     */
    let useRefCode = "";

    /** 需要导入的render-react-hoc包装器 */
    const importRenderReactHoc = new Set<string>();
    /** 插槽包装器 */
    importRenderReactHoc.add("SlotWrapper");
    /** 变量组件信息收集，用于拼装变量相关代码 */
    const variables: Array<Component> = [];

    /** 主入口、作用域插槽 需要处理下当前场景的所有 变量 和 FX卡片 */
    if (root || slot.type === "scope") {

      if (root) {
        importRenderReactHoc.add("sceneContextWrapper");
        importReactHooks.add("useEffect");
        // 处理主入口的变量和生命周期
        diagrams.forEach((diagram) => {
          if (diagram.starter.type === "var") {
            /** 处理变量 */
            const { starter } = diagram;
            const { comId } = starter;
            const component = coms[comId];
            const { frameId, parentComId } = component;
            let eventType: EventType = "var";
            if (type === "popup" && !frameId && !parentComId) {
              /** popup场景，并且不在作用域插槽下，需要包裹一层 */
              /** 目前var和com处理没什么区别，所以先直接使用popup_com */
              eventType = "popup_com"
            }
  
            const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}variable/${comId}_change`, eventType });
            this.codeArray.push(...handleEvents.start(diagram));
            variables.push(component);
          } else if (diagram.starter.type === "frame" && diagram.starter.frameId === slot.id) {
            /** 生命周期函数，这种类型的卡片一定只有一个输入 */
            const pin = diagram.starter.pinAry[0];
            if (pin) {
              const pinId = pin.id;
              importReactHooks.add("useEffect");
              slotInfo.import = slotInfo.import + `import ${pinId} from "./events/${pinId}";`;
              useEffectCode = `useEffect(() => {
                sceneContext.init(${pinId});
              }, []);
              `;
              let eventType: EventType = "page_frame";
              if (type === "popup") {
                eventType = "popup_frame";
              }
              const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}events/${pinId}`, eventType });
              this.codeArray.push(...handleEvents.start(diagram));
            }
          }
        })
      } else {
        // 处理作用域插槽的变量和生命周期
        importReactHooks.add("useEffect");
      }
     

      /** FX卡片 */
      frames.forEach((frame) => {
        const { id, diagrams } = frame;
        const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}fx/${id}`, eventType: "fx" });
        /** FX卡片一定只有一个diagram，取第一个即可 */
        this.codeArray.push(...handleEvents.start(diagrams[0]));
      })
    }

    if (variables.length) {
      /** 处理变量文件夹 */
      this.codeArray.push({
        code: `import { variableWrapper } from "@mybricks/render-react-hoc";
        ${variables.map(({ id }) => `import ${id}_change from "./${id}_change";`).join("")}

          const variable = {
            ${variables.map(({ id, title, model }) => {
              /** 变量组件特殊处理，data.initValue 就是默认值 */
              let initValue = model.data.initValue;
              const type = typeof initValue;
              if (["number", "boolean", "object", "undefined"].includes(type)) {
                initValue = JSON.stringify(initValue);
              } else {
                initValue = `"${initValue}"`;
              }
              return `
              /** ${title} */
              ${id}: {
                value: ${initValue},
                change: ${id}_change,
              }`
            })}
          };

          export default variableWrapper(variable);
        `,
        filePath: `${getFilePath(filePath)}variable/index.ts`
      })
    }

    this.codeArray.push({
      code: `import React${importReactHooks.size ? `, { ${Array.from(importReactHooks).join(", ")} }` : ""} from "react";
        ${// 导入各类包装器
          importRenderReactHoc.size ? `import { ${Array.from(importRenderReactHoc).join(", ")} } from "@mybricks/render-react-hoc";` : ""}

        ${// 导入插槽内组件、事件
          slotInfo.import}

        ${// 导出场景上下文
          root ? `export const sceneContext = sceneContextWrapper("${slot.id}");` : ""}

        /** ${slot.title} */
        export function Slot_${slot.id}() {
          ${// 写入场景的打开、作用域插槽的输入时触发的逻辑
            useEffectCode
          }

          return (
            <SlotWrapper
              style={${JSON.stringify(getSlotStyle(slot.style, root))}}
            >
              ${slotInfo.runtime}
            </SlotWrapper>
          )
        }
      `,
      filePath: `${getFilePath(filePath)}index.tsx`
    })
  }

  handleCompoents(components: Array<ComponentNode | DomNode>, handleConfig: HandleCanvasConfig) {
    components.forEach((node) => {
      if ("def" in node) {
        /** UI组件 */
        this.handleUiComponent(node, handleConfig)
      } else {
        /** 智能布局带来的数据，需要多包一层生成的Dom */
        this.handleDom(node, handleConfig)
      }
    })
  }

  handleUiComponent(component: ComponentNode, handleConfig: HandleCanvasConfig) {
    const codeArray: CodeArray = []
    const { filePath, wrapperCode, frame } = handleConfig;
    const { id: sceneId, cons, coms, pinRels, type } = this.scene;
    const { diagrams, coms: frameComs } = frame;
    const { id, def: { namespace }, slots } = component;
    /** 文件目录名称 - 存放组件runtime、事件、插槽 */
    // const dirName = `${namespace}_${id}`;
    const dirName = getFunctionName({ namespace, id });
    /** 组件函数名 */
    // const functionName = `Render_${convertToUnderscore(
    //   dirName,
    // )}`;
    const functionName = dirName.charAt(0).toUpperCase() + dirName.slice(1);
    
    const {
      title,
      model: {
        data,
        style
      },
      inputs,
      outputs,
      frameId,
      parentComId,
    } = coms[id];

    /** 
     * 在作用域插槽内
     * 此时组件的注册需要用到scopeId
     */
    const inScopeSlot = frameId && parentComId;

    /** 组件事件代码 */
    let eventsCode = "";
    /** 需要导入的组件事件代码 */
    let eventsImportCode = "";

    /** 需要导入的render-react-hoc包装器 */
    let importRenderReactHoc = new Set();
    importRenderReactHoc.add("UiComponentWrapper");
    /** ref解构代码，即inputsID，输入事件 */
    let refDeconstructCode = inScopeSlot ? "scopeId," : "";
    /** 注册组件事件代码 */
    let setComponentInputsCode = "";

    /** 输入后输出 */
    const relOutputs: Array<string> = [];
    inputs.forEach((inputId) => {
      const rels = pinRels[`${id}-${inputId}`];
      if (rels) {
        relOutputs.push(...rels);
      }

      refDeconstructCode = refDeconstructCode + `${inputId},`;
      /** TODO: 这里看之后是否需要考虑到没有输出的情况？ */
      const singleOutput = !rels ? true : rels.length < 2;
      if (singleOutput) {
        importRenderReactHoc.add("handleSingleOutput");
      } else {
        importRenderReactHoc.add("handleMultipleOutputs");
      }
      if (["show", "hide", "showOrHide"].includes(inputId)) {
        /** 这三个是同步执行的，不需要包装器 */
        setComponentInputsCode = setComponentInputsCode + `${inputId},`
      } else {
        setComponentInputsCode = setComponentInputsCode + `${inputId}: ${singleOutput ? "handleSingleOutput" : "handleMultipleOutputs"}(${inputId}),`
      }
    })

    outputs.forEach((outputId) => {
      /** 对于UI组件来说，可输出的不能是relsoutputs，虽然代码中可以实现，目前算是一个不成文规定吧 */
      if (relOutputs.includes(outputId)) {
        return
      };

      /** 用于判断输出后是否有连线 */
      const con = cons[`${id}-${outputId}`];
      if (con) {
        /** 有连线，生成逻辑代码 */
        eventsCode = eventsCode + `${outputId},`;
        eventsImportCode = `import ${outputId} from "./events/${outputId}";`;

        /** 这里是区别作用域和非作用域下的组件 */
        const diagram = diagrams.find(({ starter }) => starter.type === "com" && starter.comId === id && starter.pinId === outputId) as ComDiagram;

        let eventType: EventType = "com";

        if (type === "popup" && !frameId && !parentComId) {
          /** popup场景，并且不在作用域插槽下，需要包裹一层 */
          eventType = "popup_com"
        }

        const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}${dirName}/events/${outputId}`, eventType, inScopeSlot });
        this.codeArray.push(...handleEvents.start(diagram));
      } else {
        /** 没有连线，空函数即可 */
        eventsCode = eventsCode + `${outputId}() {},`;
      }
    })

    /** 插槽代码 */
    let slotsCode = ""
    /** 需要导入的插槽组件 */
    let slotsImportCode = ""
    if (slots) {
      Object.entries(slots).forEach(([key, slot]) => {
        slotsCode = slotsCode + `${key}: {
          ${slot.type === "scope" ? `type: "scope",` : ""}
          runtime: Slot_${key},
        },`
        slotsImportCode = slotsImportCode + `import { Slot_${key} } from "./slots/${key}";`
        this.handleSlot(slot, { filePath: `${getFilePath(filePath)}${dirName}/slots/${key}`, wrapperCode: "", parentId: id, frame: slot.type === "scope" ? frame.coms[id].frames.find(({ id }) => id === key)! : frame })
      })
    }

    /** 组件运行时代码 */
    codeArray.push({
      code: `import React, { useRef, useEffect } from "react";

      import { ${Array.from(importRenderReactHoc).join(", ")} } from "@mybricks/render-react-hoc";

      import { sceneContext } from "@/slots/slot_${sceneId}";
      ${slotsImportCode}
      ${eventsImportCode}
  
      /** ${title} - ${id} */
      export default function ${functionName}() {
        const ref = useRef<any>();

        useEffect(() => {
          const { ${refDeconstructCode} } = ref.current;
      
          sceneContext.setComponent(${inScopeSlot ? `\`\${scopeId}${id}\`` : `"${id}"`}, {
            ${setComponentInputsCode}
          });
        }, []);

        return (
          <UiComponentWrapper
            ref={ref}
            data={${JSON.stringify(data)}}
            style={${JSON.stringify(getComponentStyle(style))}}
            component={"${namespace}"}
            ${slotsCode ? `slots={{${slotsCode}}}` : ""}
            ${eventsCode? `events={{${eventsCode}}}` : ""}
          />
        );
      }
  
      `,
      filePath: `${getFilePath(filePath)}${dirName}/index.tsx`
    })

    const slotInfo = this.slotInfoMap[filePath]
    slotInfo.import = slotInfo.import + `import ${functionName} from "./${dirName}";`
    /** 经过handleDom后才会有wrapperCode */
    slotInfo.runtime = slotInfo.runtime + (wrapperCode ? wrapperCode.replace("{/* UiComponent */}", `<${functionName} />`) : `<${functionName} />`);

    this.codeArray.push(...codeArray)
  }

  handleDom(dom: DomNode, handleConfig: HandleCanvasConfig) {
    const { wrapperCode, ...other } = handleConfig;
    const domCode = `<div style={${JSON.stringify(dom.style)}}>{/* UiComponent */}</div>`;

    this.handleCompoents(dom.elements, {
      ...other,
      wrapperCode: wrapperCode ? wrapperCode.replace("{/* UiComponent */}", domCode) : domCode
    });
  }
}

/** 获取文件路径 */
function getFilePath(filePath: string) {
  return `${filePath ? `${filePath}/` : ""}`;
}
