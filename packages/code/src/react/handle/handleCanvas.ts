import { isNumber, convertToUnderscore, convertCamelToHyphen, getSlotStyle, getComponentStyle } from "@mybricks/render-utils";
import type { Frame, Slot, SlotStyle, ToBaseJSON, DomNode, ComponentNode, ComDiagram, Component, Diagram } from "@mybricks/render-types";

import { HandleEvents } from "./handleEvents";

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
      import: string;
      runtime: string;
    }
  } = {};

  constructor(private scene: ToBaseJSON) {}

  start(frame: Frame) {
    this.handleSlot(this.scene.slot, { filePath: "", wrapperCode: "", frame })

    return this.codeArray;
  }

  /** 处理Slot */
  handleSlot(slot: Slot, handleConfig: HandleCanvasConfig) {
    const { scene } = this;
    const { coms } = scene;
    const { filePath, parentId, frame } = handleConfig;
    const { diagrams } = frame;
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

    /** 变量组件信息收集，用于拼装变量相关代码 */
    let variables: Array<Component> = [];

    /** 当前使用的diagrams，主场景和作用域插槽不同 */
    let currentDiagrams: Array<Diagram> = [];

    /** 主入口、作用域插槽 需要处理下当前场景的所有变量 */
    if (!parentId || slot.type === "scope") {
      currentDiagrams = diagrams;
    }

    if (currentDiagrams.length) {
      currentDiagrams.forEach((diagram) => {
        if (diagram.starter.type === "var") {
          /** 处理变量 */
          const { starter } = diagram;
          const { comId } = starter;
          const component = coms[comId];
          // const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}${component.def.namespace}`});
          const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}variable/${comId}_change`});
          this.codeArray.push(...handleEvents.start(diagram));
          variables.push(component);
        }
      })
    }

    if (variables.length) {
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
      code: `import React from "react";

        ${!parentId ? 'import globalContext from "@/globalContext";' : ""}
        import { SlotWrapper } from "@mybricks/render-react-hoc";

        ${slotInfo.import}

        ${!parentId ? `export const sceneContext = globalContext.getScene("${slot.id}");` : ""}

        /** ${slot.title} */
        export function Slot_${slot.id}() {
          return (
            <SlotWrapper
              style={${JSON.stringify(getSlotStyle(slot.style, !parentId))}}
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
    const { id: sceneId, cons, coms, pinRels } = this.scene;
    const { diagrams, coms: frameComs } = frame;
    const { id, def: { namespace }, slots } = component;
    /** 文件目录名称 - 存放组件runtime、事件、插槽 */
    const dirName = `${namespace}_${id}`;
    /** 组件函数名 */
    const functionName = `Render_${convertToUnderscore(
      dirName,
    )}`;
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
    } = coms[id]

    /** 组件事件代码 */
    let eventsCode = "";
    /** 需要导入的组件事件代码 */
    let eventsImportCode = "";

    /** 需要导入的render-react-hoc包装器 */
    let importRenderReactHoc = new Set();
    importRenderReactHoc.add("UiComponentWrapper");
    /** ref解构代码，即inputsID，输入事件 */
    let refDeconstructCode = "";
    /** 注册组件事件代码 */
    let setComponentInputsCode = "";

    /** 输入后输出 */
    const relOutputs: Array<string> = [];
    inputs.forEach((inputId) => {
      const rels = pinRels[`${id}-${inputId}`];
      relOutputs.push(...rels);

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
        const handleEvents = new HandleEvents(this.scene, { filePath: `${getFilePath(filePath)}${dirName}/events/${outputId}` });
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
        slotsCode = slotsCode + `${key}: Slot_${key},`
        slotsImportCode = slotsImportCode + `import { Slot_${key} } from "./slots/${key}";`
        this.handleSlot(slot, { filePath: `${getFilePath(filePath)}${dirName}/slots/${key}`, wrapperCode: "", parentId: id, frame: slot.type === "scope" ? frame.coms[id].frames.find(({ id }) => id === key)! : frame })
      })
    }

    /** 组件运行时代码 */
    codeArray.push({
      code: `import React, { useRef, useEffect } from "react";

      import { ${Array.from(importRenderReactHoc).join(", ")} } from "@mybricks/render-react-hoc";

      import globalContext from "@/globalContext";
      import { sceneContext } from "@/slots/slot_${sceneId}";
      ${slotsImportCode}
      ${eventsImportCode}

      const Component = globalContext.getComponent(
        "${namespace}"
      );
  
      /** ${title} - ${id} */
      export default function ${functionName}() {
        const ref = useRef<any>();

        useEffect(() => {
          const { ${refDeconstructCode} } = ref.current;
      
          sceneContext.setComponent("${id}", {
            ${setComponentInputsCode}
          });
        }, []);

        return (
          <UiComponentWrapper
            ref={ref}
            data={${JSON.stringify(data)}}
            style={${JSON.stringify(getComponentStyle(style))}}
            component={Component}
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
