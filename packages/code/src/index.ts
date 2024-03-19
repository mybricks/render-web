import path from "path";
import fse from "fs-extra";
import * as prettier from "prettier";

import type { ToJSON, ToBaseJSON, DomNode, ComponentNode, Slot, Frame, Style } from "@mybricks/render-types"

import { isNumber, convertToUnderscore, convertCamelToHyphen } from "@mybricks/render-utils/src";

async function prettierFormatBabelTS(code: string) {
  return await prettier.format(code, { parser: "babel-ts" })
}

/**
 * 出码 
 * 当前仅考虑 多场景 toJSON.scenes
 */
export async function generateCode(toJSON: ToJSON) {
  /** TODO: 临时工程代码存放地址 */
  const tempProjectPath = path.resolve(__dirname, "tmp/react2");
  fse.emptyDirSync(tempProjectPath)
  // const tempProjectPath = path.resolve(__dirname, `tmp/${Math.random()}`);
  /** 拷贝多场景工程模版 */
  fse.copySync(path.resolve(__dirname, "./template"), tempProjectPath);

  /** 读取场景信息数组 */
  const {
    frames,
    scenes
  } = toJSON

  /** 全局上下文文本地址 */
  const globalContextPath = path.resolve(
    tempProjectPath,
    "src/globalContext/index.ts",
  );
  /** 全局上下文代码 */
  const globalContextCode = await prettierFormatBabelTS(generateGlobalContextCode({
    code: fse.readFileSync(globalContextPath, "utf-8"),
    scenes,
  }))
  /** 写入全局上下文代码 */
  fse.writeFileSync(globalContextPath, globalContextCode, "utf-8");



  /** 导出场景入口代码 */
  const scenesIndexCode = await prettierFormatBabelTS(generateScenesIndexCode({scenes}));
  /** 写入导出场景入口代码 */
  fse.writeFileSync(
    path.resolve(tempProjectPath, "src/scenes/index.ts"),
    scenesIndexCode,
    "utf-8",
  );


  /** 应用入口代码 */
  const appCode = await prettierFormatBabelTS(generateAppCode({ scenes }));
  /** 写入应用入口代码 */
  fse.writeFileSync(
    path.resolve(tempProjectPath, "src/app.tsx"),
    appCode,
    "utf-8",
  );

  /**
   * 场景代码数组
   * 每一项包含场景代码、组件的下一层slots等代码
   * Array<{ 
   *  filePath: string; - 文件路径
   *  code: string; - 代码
   * }>
   */
  const tsxArray = generateSceneTsxCode({ scenes, frames });
  /** 写入场景代码 */
  await Promise.all(tsxArray.map(async ({ filePath, code }) => {
    const absoluteFilePath = path.resolve(
      tempProjectPath,
      `src/scenes/${filePath}`,
    );
    fse.ensureDirSync(path.dirname(absoluteFilePath));
    const beautifulCode = await prettierFormatBabelTS(code)
    fse.writeFileSync(
      path.resolve(tempProjectPath, absoluteFilePath),
      beautifulCode,
      "utf-8",
    );
  }));


  /** html文件地址 */
  const indexEjsCodePath = path.resolve(
    tempProjectPath,
    "templates/index.ejs",
  );


  /** 
   * html入口文件代码 
   * 当前仅组件风格化
   */
  const indexEjsCode = await prettier.format(fse.readFileSync(indexEjsCodePath, "utf-8").replace("<!-- replace-component-styleTags -->", generateStyleTagsCode(toJSON)), { parser: "html" })
  /** 写html入口文件 */
  fse.writeFileSync(indexEjsCodePath, indexEjsCode, "utf-8");
}

/** 组件风格化代码 */
function generateStyleTagsCode(toJSON: ToJSON) {
  /** TODO: 还有模块等等需要处理 */
  const { scenes } = toJSON;
  let styleTagsCode = "";
  scenes.forEach(({ coms }) => {
    Object.entries(coms).forEach(([id, component]) => {
      const { styleAry } = component.model.style
      if (Array.isArray(styleAry)) {
        let innerHtml = "";
        styleAry.forEach(({css, selector, global}) => {
          if (selector === ':root') {
            selector = '> *:first-child'
          }
          if (Array.isArray(selector)) {
            selector.forEach((selector) => {
              innerHtml = innerHtml + getStyleInnerText({id, css, selector, global})
            })
          } else {
            innerHtml = innerHtml + getStyleInnerText({id, css, selector, global})
          }
        })
        styleTagsCode = styleTagsCode + `<style id="${id}">${innerHtml}</style>`
      }
    })
  })

  return styleTagsCode;
}

/**
 * 拼装全局上下文代码
 * 
 * 场景 ID => 场景信息 的映射关系 (一期就一个场景后面再看)
 */
function generateGlobalContextCode({
  code,
  scenes,
}: {
  code: string;
  scenes: ToBaseJSON[];
}) {
  return code.replace(
    "/** replace scenesMap */",
    `
    ${scenes.reduce((p, c) => {
      const mapStr = `
          /** ${c.title} */
          "${c.id}": {
            show: ${!p ? "true" : "false"},
            todoList: [],
            inputsData: {},
            componentPropsMap: {},
            fromComponentProps: null,
          }
        `;
      return p ? `${p},\n${mapStr}` : mapStr;
    }, "")}
  `,
  );
}

/**
 * 拼装导出场景入口代码
 */
function generateScenesIndexCode({ scenes }: { scenes: ToBaseJSON[] }) {
  return scenes.reduce((p, c) => {
    const exportStr = `export { Scene_${c.id} } from "./scene_${c.id}";`;
    return p ? `${p}\n${exportStr}` : exportStr;
  }, "");
}

/**
 * 拼装应用入口代码
 */
function generateAppCode({ scenes }: { scenes: ToBaseJSON[] }) {
  return `import React, { useMemo, useState } from "react";

  import globalContext from "@/globalContext"
  import { ${scenes.reduce(
    (p, c) => (p ? `${p}, Scene_${c.id}` : `Scene_${c.id}`),
    "",
  )} } from "@/scenes";
  
  export default function App() {
    const [, refresh] = useState(0)
    const scenesMap = useMemo(() => {
      globalContext.setScenesRefresh(refresh)
      return globalContext.scenesMap
    }, [])
  
    return (
      <>
      ${scenes.reduce(
        (p, c) =>
          p + `{/* ${c.title} */}\n{scenesMap['${c.id}'].show && <Scene_${c.id} />}`,
        "",
      )}
      </>
    );
  }
  `;
}



/**
 * 遍历场景信息，拼装场景代码
 */
function generateSceneTsxCode({ scenes, frames }: { scenes: ToBaseJSON[], frames: ToJSON["frames"] }) {
  const tsxArray: Array<{ filePath: string; code: string }> = [];
  const sceneIdTOFrameMap: any = frames.reduce((p, c) => {
    return {
      ...p,
      [c.id]: c
    }
  }, {})
  
  scenes.forEach((scene) => {
    tsxArray.push(...getTsxArray({scene, frame: sceneIdTOFrameMap[scene.id]}))
  });
  return tsxArray;
}

/**
 * 获取场景下的组件代码数组
 */
function getTsxArray({scene, frame}: {scene: ToBaseJSON, frame: ToJSON["frames"][0]}) {
  const tsxArray: Array<{ code: string; filePath: string }> = [];
  /** 场景内组件代码数组 */
  const SceneCodeArray: any = [];
  const { id, title, slot, type } = scene;
  const { style, comAry, layoutTemplate } = slot;
  const scenePath = `scene_${id}`;

  if (style.layout === 'smart') {
    /** 智能布局，使用 layoutTemplate */
    SceneCodeArray.push(...generateComponentCode(layoutTemplate, { scene, frame, filePath: scenePath }))
  } else {
    /** 非智能布局 使用 comAry */
    SceneCodeArray.push(...generateComponentCode(comAry, { scene, frame, filePath: scenePath }))
  }

  const replaceImportComponents = new Set<string>();
  const replaceUseReactHooks = new Set<string>();
  let replaceRenderComponent = "";
  let replaceFunction = "";
  let replaceUseEffect = "";

  const { diagrams } = frame

  /** 根据卡片的frameId找到当前场景的主卡片 */
  const useEffectDiagram = diagrams.find(({ starter }) => {
    return starter.type === "frame" && starter.frameId === id
  })
  if (useEffectDiagram) {
    const { codeAry, functionCode, importComponents } = generateEventCode(useEffectDiagram, { scene, filePath: scenePath })
    if (functionCode) {
      importComponents.forEach((importComponent) => {
        replaceImportComponents.add(importComponent)
      })
      tsxArray.push(...codeAry)
      // if (!type) {
        
      // } else if (type === "popup") {
        
      // }

      replaceUseEffect = `
          useEffect(() => {
            const value = sceneContext.getInputData("open");
            ${functionCode}
          }, [])
        `
      
      replaceUseReactHooks.add("useEffect")
    }
  }

  diagrams.filter(({ starter }) => {
    return starter.type === "var"
  }).map((diagram) => {
    const {
      importComponent,
      filePath,
      componentCode,
    } = generateJsComponentCode({
      // @ts-ignore
      comId: diagram.starter.comId,
      filePath: scenePath,
      scene
    });

    replaceImportComponents.add(importComponent)
    tsxArray.push({
      code: componentCode,
      filePath,
    });

    return generateEventCode(diagram, { scene, filePath: scenePath })
  }).map(({ codeAry, importComponents, functionCode }) => {
    importComponents.forEach((importComponent) => {
      replaceImportComponents.add(importComponent)
    })
    tsxArray.push(...codeAry)
    replaceFunction = replaceFunction + functionCode

    return {
      codeAry, importComponents, functionCode
    }
  })
  
  SceneCodeArray.forEach((item: any) => {
    const { importComponent, renderComponent, slotComponents, filePath, componentCode, codeArray, events } = item

    if (events) {
      events.forEach(({ codeAry, functionCode, importComponents }: any) => {
        importComponents.forEach((importComponent: string) => {
          replaceImportComponents.add(importComponent)
        })

        replaceFunction = replaceFunction + functionCode
        tsxArray.push(...codeAry)
      })
    }

    replaceRenderComponent = replaceRenderComponent + renderComponent + "\n";

    if (importComponent) {
      replaceImportComponents.add(importComponent)
      tsxArray.push({
        code: componentCode,
        filePath,
      });
    }

    if (codeArray) {
      deepSlots(codeArray)
    }
    if (slotComponents) {
      deepSlots(slotComponents, 1)
    }
  })

  function deepSlots(slots: any, next = 0) {
    slots.forEach((slot: any) => {
      const { importComponent, renderComponent, slotComponents, filePath, componentCode, codeArray, events } = slot

      if (importComponent) {
        // 文件路径和代码
        tsxArray.push({
          code: componentCode,
          filePath,
        });

        if (events) {
          events.forEach(({ codeAry }: any) => {
            tsxArray.push(...codeAry)
          })
        }

        if (!next) {
          // 当前文件需要import该组件
          replaceImportComponents.add(importComponent)
          if (events) {
            events.forEach(({ codeAry, functionCode, importComponents }: any) => {
              importComponents.forEach((importComponent: string) => {
                replaceImportComponents.add(importComponent)
              })
              replaceFunction = replaceFunction + functionCode
            })
          }
        }
        deepSlots(slotComponents, 1)
      } else {
        if (slot.code && slot.filePath) {
          // TODO: 后面再看吧
          tsxArray.push({
            code: slot.code,
            filePath: slot.filePath,
          })
        } else if (Array.isArray(codeArray)) {
          deepSlots(codeArray, next)
        }
      }
    })
  }
  const componentCode = `import React, { ${Array.from(replaceUseReactHooks).join()} } from "react";

    import globalContext from "@/globalContext";

    ${Array.from(replaceImportComponents).join("")}

    import css from "@/scenes/index.less"

    export const sceneContext = globalContext.getScene("${id}");

    ${replaceFunction}

    /** ${title} */
    export function Scene_${id} () {
      ${replaceUseEffect}
      return <div className={\`slot ${calSlotClasses(style).reduce(
        (p, c) => (p ? p + ` \${${c}}` : `\${${c}}`),
        "",
      )}\`} style={${JSON.stringify(
        calSlotStyles(style),
      )}}>${replaceRenderComponent}</div>
    }
  `;

  tsxArray.push({
    code: componentCode,
    filePath: `${scenePath}/index.tsx`,
  });

  return tsxArray;
}

/** 智能布局代码 */
function generateComponentCode(layoutTemplate: Slot["layoutTemplate"], { scene, frame, filePath }: { scene: ToBaseJSON, frame: Frame, filePath: string }) {
  const codeArray: any = []
  layoutTemplate.forEach((node) => {
    if ("def" in node) {
      codeArray.push(generateUiComponentCode(node, { scene, frame, filePath}))
    } else {
      codeArray.push(generateDomCode(node, { scene, frame, filePath}))
    }
  })
  return codeArray
}

/** 只能布局嵌套的dom结构 */
function generateDomCode(domNode: DomNode, { scene, frame, filePath}: { scene: ToBaseJSON, frame: Frame, filePath: string}) {
  const { id, elements, style } = domNode
  const codeArray: any = generateComponentCode(elements, { scene, frame, filePath })
  return {
    renderComponent:`
      <div style={${JSON.stringify(style)}}>
        ${codeArray.map(({ renderComponent }: any) => {
          return renderComponent
        }).join('')}
      </div>
    `,
    codeArray
  }
}

/** UI组件代码拼装 */
function generateUiComponentCode(component: ComponentNode, { filePath: parentFilePath, scene, frame }:  { filePath: string, scene: ToBaseJSON, frame: Frame}) {
  const { id: sceneId, coms, cons } = scene;
  const {
    id,
    def: { namespace, version },
    slots,
  } = component;
  const componentFolderName = `${namespace}_${id}`;
  /** 组件函数名 */
  const componentFunctionName = `Render_${convertToUnderscore(
    componentFolderName,
  )}`;
  const {
    title,
    model: { data, style },
    outputs,
    frameId,
    parentComId
  } = coms[id];

  /** 在作用域插槽里 */
  const isScope = frameId && parentComId;

  /** 运行时组件代码的入参类型定义 */
  let propsCode = `${frameId && parentComId ? "id: string;" : ""}`;
  /** 如果输出项ID有对应的连线信息，就有入参 */
  let eventCode = "";

  const filePath = `${parentFilePath}/${componentFolderName}`;

  const events: Array<{
    codeAry: Array<{code: string, filePath: string}>
    functionCode: string
    importComponents: Array<string>
  }> = []

  outputs.forEach((outputId) => {
    const connectionId = `${id}-${outputId}`;
    const connections = cons[connectionId];
    if (connections) {
      const diagram = frame.diagrams.find(({ starter }) => starter.type === "com" && starter.comId === id && starter.pinId === outputId)

      if (diagram) {
        /** 这里的value未来也许可以用schema？反正现在是没有的 */
        propsCode = propsCode + `${outputId}: (value: unknown) => void;\n`;
        eventCode =
          eventCode + (isScope ? ` ${outputId}={(value) => render_${convertToUnderscore(componentFolderName)}_${outputId}(value, id)}` : ` ${outputId}={render_${convertToUnderscore(componentFolderName)}_${outputId}}`);
          events.push(generateEventCode(diagram, { scene, filePath: parentFilePath }))
      }
    }
  });

  const replaceImportComponents = new Set<string>();
  let replaceSlots = "";

  const slotComponents: any = [];// 

  if (slots) {
    Object.entries(slots).forEach(([key, slot]) => {
      const result = generateSlotComponentCode(slot, { comId: id, filePath, frame, scene });
      slotComponents.push(result);
      replaceImportComponents.add(result.importComponent)
      replaceSlots =
        replaceSlots +
        `case "${key}":
      jsx = ${result.renderComponent};
      break;\n`;
    });

    replaceSlots = `const slots = new Proxy(
      {},
      {
        get(target, slotId: string) {
          return {
            render(params?: SlotProps) {
              const key = params?.key;
              let jsx = (
                <div key={key} className={css.error}>
                  {\`组件(${namespace})插槽(\${slotId})未找到。\`}
                </div>
              );
              switch (slotId) {
                ${replaceSlots}
                default:
                  break;
              }
              return jsx;
            },
          };
        },
      },
    );`;
  }

  const isPopup = namespace === "mybricks.basic-comlib.popup";

  const componentCode = `import React, { useMemo } from "react";

  ${Array.from(replaceImportComponents).join("")}

  import globalContext from "@/globalContext";
  import { sceneContext } from "@/scenes/scene_${sceneId}";
  import { observable } from "@/observable";

  import type { SlotProps } from "@/type";

  import css from "@/scenes/index.less";

  interface Props {
    ${propsCode}
    [key: string | symbol]: unknown;
  }
  
  const Runtime = globalContext.getComponentDefinition({
    namespace: "${namespace}",
    version: "${version}",
  }).runtime;
  
  /** ${title} */
  export function ${componentFunctionName}(props: Props) {
    const { data, style, inputs, outputs, ${
      slots ? "slots" : ""
    } } = useMemo(() => {
      const _inputRegs: {
        [key: string | symbol]: (value: unknown) => void;
      } = {};
      const inputs = new Proxy(
        {},
        {
          get(_, key) {
            return (fn: (value: unknown, outputs?: unknown) => void) => {
              _inputRegs[key] = (value: unknown, relOutputs?: unknown) =>
                fn(value, relOutputs || outputs);
            };
          },
        },
      );
      const outputs = new Proxy(
        {},
        {
          get(_, key) {
            return props[key] || function () {};
          },
        },
      );
      const data = observable(${JSON.stringify(data)});
      const style = observable(${JSON.stringify(style)});
      ${slots ? replaceSlots : ""}

      sceneContext.setComponent(${frameId && parentComId ? "props.id" : `"${id}"`}, {
        data,
        style,
        inputs: _inputRegs,
        outputs,
        ${slots ? "slots" : ""}
      })

      return {
        data,
        style,
        inputs,
        outputs,
        ${slots ? "slots" : ""}
      }
    }, [])

    return (
      <div className={\`${getComponentClasses().reduce(
        (p, c) => (p ? p + ` \${${c}}` : `\${${c}}`),
        "",
      )}\`} style={${JSON.stringify(getComponentStyle(style))}}>
        <Runtime env={globalContext.env} data={data} style={style} inputs={inputs} outputs={outputs} ${
          slots ? "slots={slots}" : ""
        }
        ${isPopup ? `_env={{
          currentScenes: {
            close() {
              sceneContext.close();
            },
          },
        }}` : ""}
        />
      </div>
    )
  }`;
  const importComponent = `import { ${componentFunctionName} } from "./${componentFolderName}";`;
  const renderComponent = `{/* ${title}-${id} */}
  <${componentFunctionName} ${frameId && parentComId ? `id={\`${parentComId}-${frameId}-${id}-\${id}\`}` : ""} ${eventCode}/>\n`;

  return {
    importComponent,
    renderComponent,
    filePath: `${filePath}/index.tsx`,
    componentCode,
    slotComponents,
    events,
  };
}

function getStyleInnerText ({ id, css, selector, global }: { id: string, css: Style, selector: string, global?: boolean }) {
  return `
    ${global ? '' : `#${id} `}${selector.replace(/\{id\}/g, `${id}`)} {
      ${Object.entries(css).map(([key, value]) => {
        // TODO: 单位转换？
        // if (configPxToRem && typeof value === 'string' && value.indexOf('px') !== -1) {
        //   value = pxToRem(value)
        // } else if (configPxToVw && typeof value === 'string' && value.indexOf('px') !== -1) {
        //   value = pxToVw(value)
        // }
        return `${convertCamelToHyphen(key)}: ${value};`;
      })}
    }
  `
}


/** 组件的class */
function getComponentClasses() {
  const classes = ["css.com"];

  return classes;
}

/** 组件的style */
function getComponentStyle(style: any) {
  const result: any = {
    display: style.display,
  };
  const {
    width,
    height,
    maxWidth,
    marginTop,
    marginLeft,
    marginRight,
    marginBottom,
    margin,
    position,
    flexX,
    minWidth,
  } = style;
  if (!width && !flexX) {
    result.width = "100%";
  } else if (isNumber(width)) {
    result.width = width + "px";
  } else if (width) {
    result.width = width;
  }
  if (isNumber(height)) {
    result.height = height + "px";
  } else if (height) {
    result.height = height;
  }
  if (maxWidth) {
    result.maxWidth = maxWidth;
  }
  if (minWidth) {
    result.minWidth = minWidth
  }

  if (margin) {
    result.margin = margin;
  } else {
    if (isNumber(marginTop)) {
      result.marginTop = marginTop + "px";
    }
    if (isNumber(marginLeft)) {
      if (typeof width === "number" || (marginLeft as number) < 0) {
        result.marginLeft = marginLeft + "px";
      } else {
        result.paddingLeft = marginLeft + "px";
      }
    }
    if (isNumber(marginRight)) {
      if (typeof width === "number" || (marginRight as number) < 0) {
        result.marginRight = marginRight + "px";
      } else {
        result.paddingRight = marginRight + "px";
      }
    }
    if (isNumber(marginBottom)) {
      result.marginBottom = marginBottom + "px";
    }
  }

  if (position) {
    result.position = position;
    if (["fixed", "absolute"].includes(position)) {
      const { top, left, right, bottom } = style;
      if (top || isNumber(top)) {
        result.top = isNumber(top) ? top + "px" : top;
      }
      if (bottom || isNumber(bottom)) {
        result.bottom = isNumber(bottom) ? bottom + "px" : bottom;
      }
      if (left || isNumber(left)) {
        result.left = isNumber(left) ? left + "px" : left;
      }
      if (right || isNumber(right)) {
        result.right = isNumber(right) ? right + "px" : right;
      }
      if (style.position === "fixed") {
        result.zIndex = 1000;
      } else if (style.position === "absolute") {
        result.zIndex = 1;
      }
    }
  } else {
    result.position = "relative";
  }
  return result;
}

/** 插槽的style */
function calSlotStyles(style: any) {
  Reflect.deleteProperty(style, "layout");
  // TODO: 这里观察一下


  Reflect.deleteProperty(style, "height");
  Reflect.deleteProperty(style, "width");

  return style;
}

/** 插槽的class */
function calSlotClasses(style: any) {
  const rtn = ["css.slot"];

  if (style) {
    if (style.layout?.toLowerCase() == "flex-column") {
      rtn.push("css.lyFlexColumn");
    } else if (style.layout?.toLowerCase() == "flex-row") {
      rtn.push("css.lyFlexRow");
    }

    const justifyContent = style.justifyContent;
    if (justifyContent) {
      if (justifyContent.toUpperCase() === "FLEX-START") {
        rtn.push("css.justifyContentFlexStart");
      } else if (justifyContent.toUpperCase() === "CENTER") {
        rtn.push("css.justifyContentFlexCenter");
      } else if (justifyContent.toUpperCase() === "FLEX-END") {
        rtn.push("css.justifyContentFlexFlexEnd");
      } else if (justifyContent.toUpperCase() === "SPACE-AROUND") {
        rtn.push("css.justifyContentFlexSpaceAround");
      } else if (justifyContent.toUpperCase() === "SPACE-BETWEEN") {
        rtn.push("css.justifyContentFlexSpaceBetween");
      }
    }

    const alignItems = style.alignItems;
    if (alignItems) {
      if (alignItems.toUpperCase() === "FLEX-START") {
        rtn.push("css.alignItemsFlexStart");
      } else if (alignItems.toUpperCase() === "CENTER") {
        rtn.push("css.alignItemsFlexCenter");
      } else if (alignItems.toUpperCase() === "FLEX-END") {
        rtn.push("css.alignItemsFlexFlexEnd");
      }
    }
  }

  return rtn;
}



/** JS计算代码拼装，无状态版 */
// function generateJsComponentCode({
//   comId: id,
//   filePath,
//   scene
// }: {
//   comId: string;
//   filePath: string;
//   scene: ToBaseJSON
// }, { inputs: propsInputs, outputs: propsOutputs }: { inputs: Array<string>, outputs: Array<string> }) {
//   const { coms, pinRels } = scene
//   const {
//     title,
//     def: { namespace, version },
//     model: { data },
//     outputs,
//   } = coms[id];
//   const componentFolderName = `${namespace}_${id}`;
//   const componentFunctionName = `render_${convertToUnderscore(
//     componentFolderName,
//   )}`;
//   const importComponent = `import { ${componentFunctionName} } from "./${componentFolderName}";`;

  
//   /**
//    * 运行时分三种情况
//    * 1. 没有输出
//    * 2. 有一个输出
//    * 3. 多个输出
//    */

//   let propsCode = ''
//   let runtimeCode = ''
//   const propsOutputsLength = propsOutputs.length
//   if (!propsOutputsLength) {
//     // 没有输出
//     propsCode = propsInputs.length === 1 ? `${propsInputs[0].split('.')[1] || propsInputs[0].split('.')[0]}: unknown` : `[${propsInputs.map((inputId) => `${inputId.split('.')[1]}`).join()}]: [${propsInputs.map((inputId) => `${inputId.split('.')[1]}: number`).join()}]`
    
//     const [inputId, nextInputId] = propsInputs[0].split('.')
//     const nextRels = pinRels[`${id}-${inputId}`]
    
//     runtimeCode = `
//       runtime({
//         env: globalContext.env,
//         inputs: {
//           ${inputId}(func: (value: unknown${nextRels ? `, outputs: {${nextRels.map((outputId) => `${outputId}: () => void`)}}` : ''}) => void) {
//             func(${nextInputId ? `[${propsInputs.map((inputId) => inputId.split('.')[1]).join()}]` : inputId}${nextRels ? `, {${nextRels.map((outputId) => `${outputId}() {}`)}}` : ''})
//           }
//         },
//         ${outputs.length ? `outputs: {
//           ${outputs.map((outputId) => `${outputId}(){}`).join()}
//         },` : ''}
//         data: ${JSON.stringify(data)},
//       });
//     `
//   } else if (propsOutputsLength === -1) {
//     // 目前用不到这段逻辑，因为即使只有一个输出项，也可能被重复执行的可能性，例如 循环执行
//     // 一个输出
//     propsCode = propsInputs.length === 1 ? `${propsInputs[0].split('.')[1] || propsInputs[0].split('.')[0]}: unknown` : `[${propsInputs.map((inputId) => `${inputId.split('.')[1]}`).join()}]: [${propsInputs.map((inputId) => `${inputId.split('.')[1]}: number`).join()}]`
  
//     const [inputId, nextInputId] = propsInputs[0].split('.')
//     const nextRels = pinRels[`${id}-${inputId}`]

//     runtimeCode = `
//       return new Promise((resolve) => {
//         runtime({
//           env: globalContext.env,
//           inputs: {
//             ${inputId}(func: (value: unknown${nextRels ? `, outputs: {${nextRels.map((outputId) => `${outputId}: (${propsOutputs.find((id) => id === outputId)? 'value: unknown' : ''}) => void`)}}` : ''}) => void) {
//               func(${nextInputId ? `[${propsInputs.map((inputId) => inputId.split('.')[1]).join()}]` : inputId}${nextRels ? `, {${nextRels.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? ': resolve' : '() {}'}`)}}` : ''})
//             }
//           },
//           outputs: {
//             ${outputs.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? ': resolve' : '() {}'}`)}
//           },
//           data: ${JSON.stringify(data)},
//         })
//       })
//     `
//   } else {
//     // 多个输出
//     propsCode = `{${propsOutputs.filter((id) => id).map((outputId) => {
//       return `${outputId}`
//     }).join()}}: {${propsOutputs.filter((id) => id).map((outputId) => {
//       return `${outputId}: (value: unknown) => void`
//     }).join()}}`

//     const [inputId, nextInputId] = propsInputs[0].split('.')
//     const nextRels = pinRels[`${id}-${inputId}`]

//     runtimeCode = `
//       return (${propsInputs.length === 1 ? `${propsInputs[0].split('.')[1] || propsInputs[0].split('.')[0]}: unknown` : `[${propsInputs.map((inputId) => `${inputId.split('.')[1]}`).join()}]: [${propsInputs.map((inputId) => `${inputId.split('.')[1]}: number`).join()}]`}) => {
//         runtime({
//           env: globalContext.env,
//           inputs: {
//             ${inputId}(func: (value: unknown${nextRels ? `, outputs: {${nextRels.map((outputId) => `${outputId}: (${propsOutputs.find((id) => id === outputId)? 'value: unknown' : ''}) => void`)}}` : ''}) => void) {
//               func(${nextInputId ? `[${propsInputs.map((inputId) => inputId.split('.')[1]).join()}]` : inputId}${nextRels ? `, {${nextRels.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? '' : '() {}'}`)}}` : ''})
//             }
//           },
//           outputs: {
//             ${outputs.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? '' : '() {}'}`)}
//           },
//           data: ${JSON.stringify(data)},
//         })
//       }
//     `
//   }

//   const componentCode = `import globalContext from "@/globalContext";

//     /** 原子组件代码 */
//     const runtime = globalContext.getComponentDefinition({
//       namespace: "${namespace}",
//       version: "${version}",
//     }).runtime;

//     /** ${title} */
//     export function render_${convertToUnderscore(namespace)}_${id}(${propsCode}) {
//       ${runtimeCode}
//     }
//   `

//   return {
//     importComponent,
//     filePath: `${filePath}/${componentFolderName}/index.ts`,
//     componentCode,
//   };
// }

/** JS计算代码拼装，有状态版 */
function generateJsComponentCode({
  comId: id,
  filePath,
  scene
}: {
  comId: string;
  filePath: string;
  scene: ToBaseJSON
}) {
  const { coms, pinProxies } = scene
  const {
    title,
    def: { namespace, version, rtType },
    model: { data },
    outputs,
    inputs,
    _inputs,
    frameId,
    parentComId
  } = coms[id];
  /** 说明在作用域插槽内 */
  const isScope = frameId && parentComId
  const componentFolderName = `${namespace}_${id}`;
  const componentFunctionName = `render_${convertToUnderscore(
    componentFolderName,
  )}`;
    const importComponent = `import { ${componentFunctionName} } from "./${componentFolderName}";`;
    const propsCode = `props${isScope ? "" : "?"}: {${isScope ? "id: string;" : ""}${outputs.length ? outputs.map((outputId) => `${outputId}?: (value?: unknown) => void`).join(";") + ";": ""} [key: string | symbol]: any}`
    const multipleInputIdMap: {[key: string]: Array<string>} = {}
    inputs.forEach((inputId) => {
      const [realInputId, paramId] = inputId.split(".")

      if (paramId) {
        /** 有符号 . 隔开，说明是多输入 */
        (multipleInputIdMap[realInputId] = multipleInputIdMap[realInputId] || []).push(paramId)
      }
    })

    
    const waitForInputs = `${Object.entries(multipleInputIdMap).map(([inputId, paramIds]) => {
      return `
      ${inputId}: {
        value: {},
        count: ${paramIds.length}
      }`
    })}`

    const inputRegs = `
      ${waitForInputs ? `const waitForInputs: {
        /** 多输入的输入项ID */
        [key: string]: {
          /** 最终输入的对象值，临时存储 */
          value: { [key: string]: any };
          /** 多输入个数 */
          count: number;
        };
      } = {
        ${waitForInputs}
      }` : ""}
      const _inputRegs: {
        ${Object.entries(multipleInputIdMap).map(([inputId, paramIds]) => {
          return paramIds.map((paramId) => {
            return `["${inputId}.${paramId}"]: (value: unknown) => void`
          }).join(";\n")
        })}
        [key: string | symbol]: (value: unknown) => void;
      } = {
        ${Object.entries(multipleInputIdMap).map(([inputId, paramIds]) => {
          return paramIds.map((paramId) => {
            return `["${inputId}.${paramId}"](value: unknown) {
              const waitForInput = waitForInputs["${inputId}"]
              const { value: realValue, count } = waitForInput
              realValue["${paramId}"] = value
              if (Object.keys(realValue).length === count) {
                _inputRegs["${inputId}"](realValue)
                waitForInput.value = {}
              }
            }`
          })
        })}
      };
    `
  /** 场景切换 */
  const isScene = namespace === "mybricks.core-comlib.scenes";
  /** 变量 */
  const isVar = namespace === "mybricks.core-comlib.var";
  /** 当前输入 TODO 处理完样式来搞这个 */
  const isFrameInput = namespace === "mybricks.core-comlib.frame-input"

  const componentCode = `import globalContext from "@/globalContext";
  import { sceneContext } from "@/scenes/scene_${scene.id}";

    /** 原子组件代码 */
    const runtime = globalContext.getComponentDefinition({
      namespace: "${namespace}",
      version: "${version}",
    }).runtime;

    /** ${title} */
    export function render_${convertToUnderscore(namespace)}_${id}(${propsCode}) {
      if (!sceneContext.getComponent(${isScope ? "props.id" : `"${id}"`})) {
        ${inputRegs}
        const outputs = new Proxy(
          {},
          {
            ownKeys() {
              return [${outputs.map((outputId) => `"${outputId}"`).join()}]
            },
            getOwnPropertyDescriptor() {
              return {
                enumerable: true,
                configurable: true
              };
            },
            get(_, key) {
              return props?.[key] || function () {};
            },
          },
        );
        const inputs = new Proxy(
          {},
          {
            get(_, key) {
              return (fn: (value: unknown, outputs?: unknown) => void) => {
                _inputRegs[key] = (value: unknown, relOutputs?: unknown) =>
                  fn(value, relOutputs || outputs);
              };
            },
          },
        );
        const data = ${JSON.stringify(data)};

        runtime({
          env: globalContext.env,
          inputs,
          outputs,
          data,
          ${isScene ? `_inputsCallable: {
            _open: (value: unknown) => {
              const scene = globalContext.getScene("${pinProxies[`${id}-_open`].frameId}");
              scene.setInputData("open", value);
              scene.setFromComponentProps({
                inputs: _inputRegs,
                outputs,
                data,
              });
            },
            ${""
            //   _inputs.map((_inputId) => { // TODO:后面再看，目前没必要这样解析
            //   const { type, frameId, pinId } = pinProxies[`${id}-${_inputId}`]
            //   return `${_inputId}: (value: unknown) => {
            //     scene.setTodo({ pinId: "${pinId}", value })
            //   }`
            // }).join()
            }
          },
          ` : ""}
          ${/** TODO: 变量绑定相关 */isVar ? `
          _notifyBindings() {}
          ` : ""}
        });

        sceneContext.setComponent(${isScope ? "props.id" : `"${id}"`}, {
          inputs: _inputRegs,
          outputs,
          data,
        });
      }
    }
  `

  return {
    importComponent,
    filePath: `${filePath}/${componentFolderName}/index.ts`,
    componentCode,
  };
}

function generateSlotComponentCode(slot: Slot, { comId, filePath: parentFilePath, scene, frame }: { comId: string, filePath: string, scene: ToBaseJSON, frame: Frame }) {
  const slotComponents: any = [];
  const { id, title, comAry, style, layoutTemplate, type } = slot;
  const filePath = `${parentFilePath}/slots/${id}`;
  const nextFrame = frame.coms[comId]?.frames.find((frame) => frame.id === slot.id) || frame
  const isScope = type === "scope";

  if (style.layout === 'smart') {
    /** 智能布局，使用 layoutTemplate */
    slotComponents.push(...generateComponentCode(layoutTemplate, { scene, frame: nextFrame, filePath }))
  } else {
    /** 非智能布局 使用 comAry */
    slotComponents.push(...generateComponentCode(comAry, { scene, frame: nextFrame, filePath }))
  }

  const replaceImportComponents = new Set<string>();
  let replaceRenderComponent = "";
  let replaceFunction = "";
  let replaceVarFunction = "";

  nextFrame.diagrams.filter(({ starter }) => {
    return starter.type === "var"
  }).map((diagram) => {
    const {
      importComponent,
      filePath: jsFilePath,
      componentCode,
    } = generateJsComponentCode({
      // @ts-ignore
      comId: diagram.starter.comId,
      filePath,
      scene
    });

    replaceImportComponents.add(importComponent)
    slotComponents.push({codeArray: [{code: componentCode, filePath: jsFilePath}]})
    // tsxArray.push({
    //   code: componentCode,
    //   filePath,
    // });

    return generateEventCode(diagram, { scene, filePath })
  }).map(({ codeAry, importComponents, functionCode }) => {
    importComponents.forEach((importComponent) => {
      replaceImportComponents.add(importComponent)
    })
    // tsxArray.push(...codeAry)
    slotComponents.push({codeArray: codeAry})
    replaceVarFunction = replaceVarFunction + functionCode

    return {
      codeAry, importComponents, functionCode
    }
  })

  function deepSlots(slots: any, next = 0) {
    slots.forEach((slot: any) => {
      const { importComponents, importComponent, renderComponent, slotComponents, filePath, componentCode, codeArray, events } = slot
      if (!next && renderComponent) {
        replaceRenderComponent = replaceRenderComponent + renderComponent + "\n";
      }
      if (importComponent) {
        replaceImportComponents.add(importComponent)
        events?.forEach(({ functionCode, importComponents }: any) => {
          importComponents.forEach((importComponent: string) => {
            replaceImportComponents.add(importComponent)
          })
          replaceFunction = replaceFunction + functionCode
        })
      } else if (codeArray) {
        deepSlots(codeArray, 1)
      }
    })
  }

  deepSlots(slotComponents)

  let replaceUseEffect = "";
  let replaceUseReactHooks = new Set<string>(["useMemo"]);

  /** 根据卡片的frameId找到当前场景的主卡片，且必须是作用域卡片 */
  const useEffectDiagram = isScope && nextFrame?.diagrams.find(({ starter }) => {
    return starter.type === "frame" && starter.frameId === id
  })
  if (useEffectDiagram && useEffectDiagram.starter.type === "frame") {
    const pinAry = useEffectDiagram.starter.pinAry;
    const { codeAry, functionCode, importComponents } = generateEventCode(useEffectDiagram, { scene, filePath, slotId: id, comId })
    if (functionCode) {
      importComponents.forEach((importComponent) => {
        replaceImportComponents.add(importComponent)
      })
      slotComponents.push({codeArray: codeAry})

      replaceUseEffect = `
          useEffect(() => {
            if (inputValues) {
              const { ${pinAry.map(({ id }) => id).join()} } = inputValues;
              ${functionCode}
            }
          }, [inputValues])

          useEffect(() => {
            return () => {
              console.log("销毁")
            }
          }, [])
        `
      
      replaceUseReactHooks.add("useEffect")
    }
  }

  const componentCode = `import React, { ${Array.from(replaceUseReactHooks).join()} } from "react";

  import { sceneContext } from "@/scenes/scene_${scene.id}";

  ${Array.from(replaceImportComponents).join("")}

  import type { SlotProps } from "@/type";

  import css from "@/scenes/index.less";

  ${replaceFunction}

  /** ${title} */
  export function Slot_${id} ({ inputValues }: SlotProps) {
    const { id } = useMemo(() => {
      const id = String(Math.random());
      ${replaceVarFunction}
      return {
        id
      };
    }, []);

    ${replaceUseEffect}

    return useMemo(() => {
      return <div className={\`slot ${calSlotClasses(style).reduce(
        (p, c) => (p ? p + ` \${${c}}` : `\${${c}}`),
        "",
      )}\`} style={${JSON.stringify(
        calSlotStyles(style),
      )}}>${replaceRenderComponent}</div>
    }, []);
  }
  `;

  const componentFolderName = id;
  const componentFunctionName = `Slot_${componentFolderName}`;

  const importComponent = `import { ${componentFunctionName} } from "./slots/${componentFolderName}";`;
  const renderComponent = `/** ${title}-${id} */ <${componentFunctionName} key={key} {...params} />\n`;

  return {
    importComponent,
    renderComponent,
    filePath: `${filePath}/index.tsx`,
    componentCode,
    slotComponents,
  };
}

/** 事件卡片 、 主场景 代码生成 */
function generateEventCode(diagram: Frame['diagrams'][0], { scene, filePath: parentFilePath, slotId, comId }: { isEvent?: boolean, scene: ToBaseJSON, filePath: string, slotId?: string, comId?: string }) {
  const { conAry, starter } = diagram
  const { cons } = scene
  const executeIdToNextMap: any = {}
  conAry.forEach((con) => {
    const { from, to, finishPinParentKey, startPinParentKey } = con
    const { id: outputId, parent: { id: fromComId, type: fromType } } = from;
    const { id: inputId, parent: { id: toComId, type: toType } } = to;
    // TODO: 这里后面再改，还有fx的情况没有处理
    // 传入 slotId 说明是插槽的入参
    /** fromComId === scene.id ? "_rootFrame_" 这个表示是场景的输入 */
    const toCons = cons[`${fromType === 'frame' ? (fromComId === scene.id ? "_rootFrame_" : `${comId}-${fromComId}`) : fromComId}-${outputId}`]
    const inReg = toCons.find((con) => con.pinId === inputId)

    let comNextMap = executeIdToNextMap[fromComId]

    if (!comNextMap) {
      comNextMap = executeIdToNextMap[fromComId] = {}
    }

    let comOutputs = comNextMap[outputId]

    if (!comOutputs) {
      comOutputs = comNextMap[outputId] = []
    }

    if (inReg.type === "com") {
      comOutputs.push({
        comId: toComId,
        pinId: inputId,
        finishPinParentKey,
        startPinParentKey
      })
    } else if (inReg.type === "frame") {
      comOutputs.push({
        frameId: inReg.frameId,
        pinId: inputId,
        finishPinParentKey,
        startPinParentKey
      })
    }
  })

  const { codeAry, eventCode, importComponents } = generateEventInternalCode(diagram, { scene, filePath: parentFilePath, executeIdToNextMap })

  const { type } = starter
  if (type === "com") {
    const { comId, pinId } = starter
    const component = scene.coms[comId]
    const { frameId, parentComId } = component;
    const isScope = frameId && parentComId;

    return {
      codeAry,
      importComponents,
      functionCode: `
        /** ${component.title} - ${comId} - ${pinId} 事件 */
        function render_${convertToUnderscore(component.def.namespace)}_${comId}_${pinId}(value: unknown${isScope ? ", id: string" : ""}) {
          ${eventCode}
        }
      `
    }
  } else if (type === "var") {
    const { comId, pinId } = starter
    const component = scene.coms[comId]
    const { frameId, parentComId } = component;
    const isScope = frameId && parentComId;
    /** 变量比较特殊，需要在外层提前执行 */

    return {
      codeAry,
      importComponents,
      functionCode: `
        /** ${component.title} - ${comId} - ${pinId} 事件 */
        render_${convertToUnderscore(component.def.namespace)}_${comId}({${isScope ? `id: \`${parentComId}-${frameId}-${comId}-\${id}\`,` : ""}
          ${pinId}(value: unknown) {
            ${eventCode}
          }
        })
      `
    }
  } else if (type === "frame") {
    return {
      codeAry,
      functionCode: eventCode,
      importComponents
    }
  }


  return {
    codeAry: [],
    functionCode: "",
    importComponents: []
  }
}

/** 卡片内部逻辑 - 通用 */
function generateEventInternalCode(diagram: Frame['diagrams'][0], { scene, filePath: parentFilePath, executeIdToNextMap }: { scene: ToBaseJSON, filePath: string, executeIdToNextMap: {[key: string]: {[key: string]: Array<{comId: string, frameId: string, pinId: string, startPinParentKey?: string, finishPinParentKey?: string}>}}}) {
  /** 
   * 事件卡片一定只有一个开头
   * 已知启始节点
   */
  const importComponents = new Set<string>()
  const tsxArray: any = []
  const { coms, pinRels } = scene
  const { starter } = diagram

  /** 记录已经import进来的组件ID */
  const importComponentIdMap: {[key: string]: true} = {}
  /** 顶部执行的组件列表 */
  const topComponent: Array<string> = []
  /** 记录已经在顶部执行的组件ID */
  const topComponentIdMap: {[key: string]: true} = {}

  const generateNextEventCode2 = (
    nexts: Array<{comId: string, frameId: string, pinId: string, startPinParentKey?: string, finishPinParentKey?: string}>,
    { inputId, executeIdToNextMap }: { inputId?: string, executeIdToNextMap: {[key: string]: {[key: string]: Array<{comId: string, frameId: string, pinId: string, startPinParentKey?: string, finishPinParentKey?: string}>}} }
  ): string => {
    const valueCode = inputId || "value";
    return nexts.map(({ comId, frameId, pinId, finishPinParentKey }) => {
      if (frameId) {
        // TODO: 判断场景和FX？
        return `/** 场景输出 - ${pinId} */
        sceneContext.getFromComponentProps()?.outputs["${pinId}"](${valueCode});
          ${/** popup场景输出不是apply的话默认关闭 */ pinId !== "apply" ? "/** 关闭当前场景 */\nsceneContext.close();" : ""}
        `
      }
      const component = coms[comId]
      const { frameId: slotId, parentComId } = component
      const isScope = slotId && parentComId
      const realComponentKey = isScope ? `\`${parentComId}-${slotId}-${comId}-\${id}\`` : `"${comId}"`
      // const realComponentKey = componentKey.replace("{comId}", comId);
      
      if (!component.def.rtType || component.def.namespace === "mybricks.core-comlib.var") {
        /** 变量组件的特殊处理 */
        /** 目前ui组件没有多输入的情况 */
        /** ui组件、单输入，在连线过程中一定是依赖pinRels来输出的 */
        const nextRels = pinRels[`${comId}-${pinId}`]
        if (!nextRels) {
          // 没有下一步，直接输出
          return `
          /** 执行 ${component.title} - ${comId} - ${pinId} */
          sceneContext.getComponent(${realComponentKey}).inputs["${pinId}"](${valueCode})`
        } else {
          return `
          /** 执行 ${component.title} - ${comId} - ${pinId} */
          sceneContext.getComponent(${realComponentKey}).inputs["${pinId}"](${valueCode}, {
            ${nextRels.map((outputId) => {
              let nexts = executeIdToNextMap[comId]?.[outputId]
              if (nexts) {
                if (finishPinParentKey) {
                  nexts = nexts.filter((next) => next.startPinParentKey === finishPinParentKey)
                }
                const nextEventCode = generateNextEventCode2(nexts, { executeIdToNextMap })
                return nextEventCode ? `${outputId}(value: unknown) {
                  ${nextEventCode}
                }` : `${outputId}(){}`
              } else {
                return `${outputId}() {}`
              }
            })}
          })`
        }
      }
      /** 
       * 只有计算组件，在有多个输入项的情况下，会全部展示出来
       * 每个输入项，只能被连接一次（否则，所有组件都需要提前声明了）
       */
      const { inputs } = component
      const componentOutputs = executeIdToNextMap[comId]

      if (!importComponentIdMap[comId]) {
        importComponentIdMap[comId] = true
        /** 没有导入过的组件 */
        const {
          importComponent,
          filePath,
          componentCode,
        } = generateJsComponentCode({
          comId: comId,
          filePath: parentFilePath,
          scene
        });

        importComponents.add(importComponent)

        tsxArray.push({
          code: componentCode,
          filePath,
        });
      }

      if (!componentOutputs) {
        /** 没有下一步，直接执行就结束了 */
        if (inputs.length > 1) {
          if (!topComponentIdMap[comId]) {
            topComponentIdMap[comId] = true
            /** 输入项大于1，说明需要把函数提前执行 */
            topComponent.push(`
              /** ${component.title} - ${comId} */
              render_${convertToUnderscore(component.def.namespace)}_${comId}(${isScope ? `{ id: ${realComponentKey} }` : ""});
            `)
          }

          return `
            /** 执行 ${component.title} - ${comId} - ${pinId} */
            sceneContext.getComponent(${realComponentKey}).inputs["${pinId}"](${valueCode});
          `
        }

        return `
          /** ${component.title} - ${comId} */
          render_${convertToUnderscore(component.def.namespace)}_${comId}(${isScope ? `{ id: ${realComponentKey} }` : ""});
          /** 执行 ${component.title} - ${comId} - ${pinId} */
          sceneContext.getComponent(${realComponentKey}).inputs["${pinId}"](${valueCode});
        `
      }

      if (inputs.length > 1) {
        if (!topComponentIdMap[comId]) {
          topComponentIdMap[comId] = true
          /** 输入项大于1，说明需要把函数提前执行 */
          topComponent.push(`
            /** ${component.title} - ${comId} */
            render_${convertToUnderscore(component.def.namespace)}_${comId}({${isScope ? `id: ${realComponentKey},` : ""}
              ${Object.keys(componentOutputs).map((outputId) => {
                return `
                  ${outputId}(value: unknown) {
                    ${generateNextEventCode2(componentOutputs[outputId], { executeIdToNextMap })}
                  }
                `
              })}
            })
          `)
        }

        return `
          /** 执行 ${component.title} - ${comId} - ${pinId} */
          sceneContext.getComponent(${realComponentKey}).inputs["${pinId}"](${valueCode});
        `
      }

      return `
        /** ${component.title} - ${comId} */
        render_${convertToUnderscore(component.def.namespace)}_${comId}({${isScope ? `id: ${realComponentKey},` : ""}
          ${Object.keys(componentOutputs).map((outputId) => {
            return `
              ${outputId}(value: unknown) {
                ${generateNextEventCode2(componentOutputs[outputId], { executeIdToNextMap })}
              }
            `
          })}
        })

        /** 执行 ${component.title} - ${comId} - ${pinId} */
        sceneContext.getComponent(${realComponentKey}).inputs["${pinId}"](${valueCode});
      `
    }).join("\n")
  }

  let eventCode = "";

  /** TODO: 如果是多输入的话，是不是code拼起来就好了？- 一会儿观察一下作用域插槽那块 */
  // ["com", "var"].includes(starter.type) - 看下ts配置
  if (starter.type === "com" || starter.type === "var") {
    const nexts = executeIdToNextMap[starter.comId]?.[starter.pinId]
    eventCode = nexts && generateNextEventCode2(nexts, { executeIdToNextMap })
  } else {
    // 目前就 com 和 frame
    const { frameId, pinAry } = starter
    const notScope = starter.frameId === scene.id

    pinAry.forEach(({ id }) => {
      const nexts = executeIdToNextMap[frameId]?.[id]
      nexts && (eventCode = eventCode + generateNextEventCode2(nexts, { executeIdToNextMap, inputId: notScope ? void 0 : id }))
    })
  }

  return {
    codeAry: tsxArray,
    eventCode: eventCode ? `
      ${topComponent.join("\n")}

      ${eventCode}
    ` : "",
    importComponents: Array.from(importComponents),
  }
}
