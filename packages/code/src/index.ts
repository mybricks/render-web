import path from "path";
import fse from "fs-extra";
import * as prettier from "prettier";

import type { ToJSON, ToBaseJSON, DomNode, ComponentNode, Slot, Frame } from "@mybricks/render-types"

import { isNumber, convertToUnderscore } from "@mybricks/render-utils/src";

async function prettierFormatBabelTS(code: string) {
  return await prettier.format(code, { parser: "babel-ts" })
}

/**
 * 出码 
 * 当前仅考虑 多场景 toJSON.scenes
 */
export async function generateCode(toJSON: ToJSON) {
  /** 临时工程代码存放地址 */
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
  // const globalContextCode = generateGlobalContextCode({
  //   code: fse.readFileSync(globalContextPath, "utf-8"),
  //   scenes,
  // });
  const globalContextCode = await prettierFormatBabelTS(generateGlobalContextCode({
    code: fse.readFileSync(globalContextPath, "utf-8"),
    scenes,
  }))
  /** 写入全局上下文代码 */
  fse.writeFileSync(globalContextPath, globalContextCode, "utf-8");



  /** 导出场景入口代码 */
  // const scenesIndexCode = generateScenesIndexCode({scenes});
  const scenesIndexCode = await prettierFormatBabelTS(generateScenesIndexCode({scenes}));
  /** 写入导出场景入口代码 */
  fse.writeFileSync(
    path.resolve(tempProjectPath, "src/scenes/index.ts"),
    scenesIndexCode,
    "utf-8",
  );


  /** 应用入口代码 */
  // const appCode = generateAppCode({ scenes });
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
  // tsxArray.forEach(({ filePath, code }) => {
  //   const absoluteFilePath = path.resolve(
  //     tempProjectPath,
  //     `src/scenes/${filePath}`,
  //   );
  //   fse.ensureDirSync(path.dirname(absoluteFilePath));
  //   fse.writeFileSync(
  //     path.resolve(tempProjectPath, absoluteFilePath),
  //     code,
  //     "utf-8",
  //   );
  // });


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

  /** 美化代码 */
  // execSync(`npx prettier --write ${tempProjectPath}`);
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
            todo: [],
            componentPropsMap: {}
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
          p + `{/* ${c.title} */}\n{scenesMap['${c.id}'] && <Scene_${c.id} />}`,
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
  const SceneCodeArray = [];
  const { id, title, slot, coms } = scene;
  const { style, comAry, layoutTemplate } = slot;
  const scenePath = `scene_${id}`;

  if (style.layout === 'smart') {
    /** 智能布局，使用 layoutTemplate */
    SceneCodeArray.push(...generateComponentCode(layoutTemplate, { scene, frame, filePath: scenePath }))
  } else {
    /** 非智能布局 使用 comAry */
    SceneCodeArray.push(...generateComponentCode(comAry, { scene, frame, filePath: scenePath }))
  }

  let replaceImportComponent = "";
  let replaceRenderComponent = "";
  let replaceFunction = ''
  let replaceFunctionUtils = ''

  SceneCodeArray.forEach((item) => {
    const { importComponent, renderComponent, slotComponents, filePath, componentCode, codeArray, events } = item

    if (events) {
      events.forEach(({ codeAry, functionCode, importComponent, useAsyncPipe }: any) => {
        replaceImportComponent = replaceImportComponent + importComponent
        replaceFunction = replaceFunction + functionCode
        tsxArray.push(...codeAry)
        if (useAsyncPipe) {
          replaceFunctionUtils = 'import { asyncPipe, createPromise } from "@/utils";'
        }
      })
    }

    replaceRenderComponent = replaceRenderComponent + renderComponent + "\n";

    if (importComponent) {
      replaceImportComponent = replaceImportComponent + importComponent
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
          replaceImportComponent = replaceImportComponent + importComponent
          if (events) {
            events.forEach(({ codeAry, functionCode, importComponent, useAsyncPipe }: any) => {
              replaceImportComponent = replaceImportComponent + importComponent
              replaceFunction = replaceFunction + functionCode
             
              if (useAsyncPipe) {
                replaceFunctionUtils = 'import { asyncPipe, createPromise } from "@/utils";'
              }
            })
          }
        }
        deepSlots(slotComponents, 1)
      } else {
        deepSlots(codeArray, next)
      }
    })
  }

  const componentCode = `import React from "react";

    ${replaceFunctionUtils}
    ${replaceImportComponent}

    import css from "@/scenes/index.less"

    ${replaceFunction}

    /** ${title} */
    export function Scene_${id} () {
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
  } = coms[id];

  /** 运行时组件代码的入参类型定义 */
  let propsCode = "";
  /** 如果输出项ID有对应的连线信息，就有入参 */
  let eventCode = "";

  const filePath = `${parentFilePath}/${componentFolderName}`;

  const events: Array<{
    codeAry: Array<{code: string, filePath: string}>
    functionCode: string
    importComponent: string
  }> = []

  outputs.forEach((outputId) => {
    const connectionId = `${id}-${outputId}`;
    const connections = cons[connectionId];
    if (connections) {
      /** 这里的value未来也许可以用schema？反正现在是没有的 */
      propsCode = propsCode + `${outputId}: (value: unknown) => void;\n`;
      eventCode =
        eventCode + ` ${outputId}={render_${convertToUnderscore(componentFolderName)}_${outputId}}`;

      const diagram = frame.diagrams.find(({ starter }) => starter.comId === id && starter.pinId === outputId)

      if (diagram) {
        events.push(generateEventCode(diagram, { scene, filePath: parentFilePath }))
      }
    }
  });

  

  let replaceImportComponent = "";
  let replaceSlots = "";

  const slotComponents: any = [];

  // TODO: 组件插槽处理
  if (slots) {
    Object.entries(slots).forEach(([key, slot]) => {
      const result = generateSlotComponentCode(slot, { filePath, frame, scene });

      slotComponents.push(result);

      replaceImportComponent =
        replaceImportComponent + result.importComponent + "\n";
      replaceSlots =
        replaceSlots +
        `case "${key}":
      jsx = ${result.renderComponent};
      break;\n`;
    });

    replaceSlots = `const slots = new Proxy(
      {},
      {
        get(target, slotId) {
          return {
            render() {
              let jsx = <></>;
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

  const componentCode = `import React, { useMemo } from "react";

  ${replaceImportComponent}

  import globalContext from "@/globalContext";
  import { observable } from "@/observable";

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
      const _inputRegs: { [key: string | symbol]: (value: unknown) => void } = {};
      const inputs = new Proxy(
        {},
        {
          get(_, key) {
            return (fn: (value: unknown) => void) => {
              _inputRegs[key] = fn;
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

      globalContext.scenesMap["${sceneId}"].componentPropsMap["${id}"] = {
        data,
        style,
        inputs,
        outputs,
        _inputRegs,
        ${slots ? "slots" : ""}
      };

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
        } />
      </div>
    )
  }`;
  const importComponent = `import { ${componentFunctionName} } from "./${componentFolderName}";`;
  const renderComponent = `{/* ${title}-${id} */}
  <${componentFunctionName} ${eventCode}/>\n`;

  return {
    importComponent,
    renderComponent,
    filePath: `${filePath}/index.tsx`,
    componentCode,
    slotComponents,
    events
  };
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
  // TODO


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



// TODO: JS计算代码拼装
function generateJsComponentCode({
  comId: id,
  filePath,
  scene
}: {
  comId: string;
  filePath: string;
  scene: ToBaseJSON
}, { inputs: propsInputs, outputs: propsOutputs }: { inputs: Array<string>, outputs: Array<string> }) {
  const { coms, pinRels } = scene
  const {
    title,
    def: { namespace, version },
    model: { data },
    outputs,
  } = coms[id];
  const componentFolderName = `${namespace}_${id}`;
  const componentFunctionName = `render_${convertToUnderscore(
    componentFolderName,
  )}`;
  const importComponent = `import { ${componentFunctionName} } from "./${componentFolderName}";`;

  
  /**
   * 运行时分三种情况
   * 1. 没有输出
   * 2. 有一个输出
   * 3. 多个输出
   */

  let propsCode = ''
  let runtimeCode = ''
  const propsOutputsLength = propsOutputs.length
  if (!propsOutputsLength) {
    // 没有输出
    propsCode = propsInputs.length === 1 ? `${propsInputs[0].split('.')[1] || propsInputs[0].split('.')[0]}: unknown` : `[${propsInputs.map((inputId) => `${inputId.split('.')[1]}`).join()}]: [${propsInputs.map((inputId) => `${inputId.split('.')[1]}: number`).join()}]`
    
    const [inputId, nextInputId] = propsInputs[0].split('.')
    const nextRels = pinRels[`${id}-${inputId}`]
    
    runtimeCode = `
      runtime({
        env: globalContext.env,
        inputs: {
          ${inputId}(func: (value: unknown${nextRels ? `, outputs: {${nextRels.map((outputId) => `${outputId}: () => void`)}}` : ''}) => void) {
            func(${nextInputId ? `[${propsInputs.map((inputId) => inputId.split('.')[1]).join()}]` : inputId}${nextRels ? `, {${nextRels.map((outputId) => `${outputId}() {}`)}}` : ''})
          }
        },
        ${outputs.length ? `outputs: {
          ${outputs.map((outputId) => `${outputId}(){}`).join()}
        },` : ''}
        data: ${JSON.stringify(data)},
      });
    `
  } else if (propsOutputsLength === -1) {
    // 目前用不到这段逻辑，因为即使只有一个输出项，也可能被重复执行的可能性，例如 循环执行
    // 一个输出
    propsCode = propsInputs.length === 1 ? `${propsInputs[0].split('.')[1] || propsInputs[0].split('.')[0]}: unknown` : `[${propsInputs.map((inputId) => `${inputId.split('.')[1]}`).join()}]: [${propsInputs.map((inputId) => `${inputId.split('.')[1]}: number`).join()}]`
  
    const [inputId, nextInputId] = propsInputs[0].split('.')
    const nextRels = pinRels[`${id}-${inputId}`]

    runtimeCode = `
      return new Promise((resolve) => {
        runtime({
          env: globalContext.env,
          inputs: {
            ${inputId}(func: (value: unknown${nextRels ? `, outputs: {${nextRels.map((outputId) => `${outputId}: (${propsOutputs.find((id) => id === outputId)? 'value: unknown' : ''}) => void`)}}` : ''}) => void) {
              func(${nextInputId ? `[${propsInputs.map((inputId) => inputId.split('.')[1]).join()}]` : inputId}${nextRels ? `, {${nextRels.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? ': resolve' : '() {}'}`)}}` : ''})
            }
          },
          outputs: {
            ${outputs.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? ': resolve' : '() {}'}`)}
          },
          data: ${JSON.stringify(data)},
        })
      })
    `
  } else {
    // 多个输出
    propsCode = `{${propsOutputs.filter((id) => id).map((outputId) => {
      return `${outputId}`
    }).join()}}: {${propsOutputs.filter((id) => id).map((outputId) => {
      return `${outputId}: (value: unknown) => void`
    }).join()}}`

    const [inputId, nextInputId] = propsInputs[0].split('.')
    const nextRels = pinRels[`${id}-${inputId}`]

    runtimeCode = `
      return (${propsInputs.length === 1 ? `${propsInputs[0].split('.')[1] || propsInputs[0].split('.')[0]}: unknown` : `[${propsInputs.map((inputId) => `${inputId.split('.')[1]}`).join()}]: [${propsInputs.map((inputId) => `${inputId.split('.')[1]}: number`).join()}]`}) => {
        runtime({
          env: globalContext.env,
          inputs: {
            ${inputId}(func: (value: unknown${nextRels ? `, outputs: {${nextRels.map((outputId) => `${outputId}: (${propsOutputs.find((id) => id === outputId)? 'value: unknown' : ''}) => void`)}}` : ''}) => void) {
              func(${nextInputId ? `[${propsInputs.map((inputId) => inputId.split('.')[1]).join()}]` : inputId}${nextRels ? `, {${nextRels.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? '' : '() {}'}`)}}` : ''})
            }
          },
          outputs: {
            ${outputs.map((outputId) => `${outputId}${propsOutputs.find((id) => id === outputId) ? '' : '() {}'}`)}
          },
          data: ${JSON.stringify(data)},
        })
      }
    `
  }

  const componentCode = `import globalContext from "@/globalContext";

    /** 原子组件代码 */
    const runtime = globalContext.getComponentDefinition({
      namespace: "${namespace}",
      version: "${version}",
    }).runtime;

    /** ${title} */
    export function render_${convertToUnderscore(namespace)}_${id}(${propsCode}) {
      ${runtimeCode}
    }
  `

  return {
    importComponent,
    filePath: `${filePath}/${componentFolderName}/index.ts`,
    componentCode,
  };
}

function generateSlotComponentCode(slot: Slot, { filePath: parentFilePath, scene, frame }: { filePath: string, scene: ToBaseJSON, frame: Frame }) {
  const slotComponents: any = [];
  const { id, title, comAry, style, layoutTemplate } = slot;
  const filePath = `${parentFilePath}/slots/${id}`;

  if (style.layout === 'smart') {
    /** 智能布局，使用 layoutTemplate */
    slotComponents.push(...generateComponentCode(layoutTemplate, { scene, frame, filePath: filePath }))
  } else {
    /** 非智能布局 使用 comAry */
    slotComponents.push(...generateComponentCode(comAry, { scene, frame, filePath: filePath }))
  }

  let replaceImportComponent = "";
  let replaceRenderComponent = "";
  let replaceFunction = "";
  let replaceFunctionUtils = "";

  function deepSlots(slots: any, next = 0) {
    slots.forEach((slot: any) => {
      const { importComponent, renderComponent, slotComponents, filePath, componentCode, codeArray, events } = slot
      if (!next) {
        replaceRenderComponent = replaceRenderComponent + renderComponent + "\n";
      }
      if (importComponent) {
        replaceImportComponent = replaceImportComponent + importComponent+ "\n";
        events?.forEach(({ functionCode, importComponent, useAsyncPipe }: any) => {
          replaceImportComponent = replaceImportComponent + importComponent
          replaceFunction = replaceFunction + functionCode
          if (useAsyncPipe) {
            replaceFunctionUtils = 'import { asyncPipe, createPromise } from "@/utils";'
          }
        })
      } else if (codeArray) {
        deepSlots(codeArray, 1)
      }
    })
  }

  deepSlots(slotComponents)

  // TODO generateUiComponentCode 应该再给出connection信息
  const componentCode = `import React from "react";

  ${replaceFunctionUtils}
  ${replaceImportComponent}

  import css from "@/scenes/index.less"

  ${replaceFunction}

  /** ${title} */
  export function Slot_${id} () {
    return <div className={\`slot ${calSlotClasses(style).reduce(
      (p, c) => (p ? p + ` \${${c}}` : `\${${c}}`),
      "",
    )}\`} style={${JSON.stringify(
      calSlotStyles(style),
    )}}>${replaceRenderComponent}</div>
  }
  `;

  const componentFolderName = id;
  const componentFunctionName = `Slot_${componentFolderName}`;

  const importComponent = `import { ${componentFunctionName} } from "./slots/${componentFolderName}";`;
  const renderComponent = `/** ${title}-${id} */ <${componentFunctionName} />\n`;

  return {
    importComponent,
    renderComponent,
    filePath: `${filePath}/index.tsx`,
    componentCode,
    slotComponents,
  };
}

/** 处理事件 - 卡片 */
function generateEventCode(diagram: Frame['diagrams'][0], { scene, filePath: parentFilePath }: { scene: ToBaseJSON, filePath: string}) {

  const tsxArray: any = []
  let useAsyncPipe = false

  let replaceImportComponent = ''

  const { coms } = scene
  const { starter, conAry } = diagram
  /** 组件ID -> outputID -> 被执行输入的组件列表 */
  const executeIdToOutputsMap: {[key: string]: {[key: string]: Array<{comId: string,pinId: string}>}} = {}
  /** 记录组件ID对应被触发输入的个数 */
  const executeComIdToInputCountMap: {[key: string]: number} = {}

  conAry.forEach((con) => {
    const { from, to } = con
    const { id: outputId, parent: { id: fromComId } } = from;
    const { id: inputId, parent: { id: toComId } } = to;

    let comOutputsMap = executeIdToOutputsMap[fromComId]

    if (!comOutputsMap) {
      comOutputsMap = executeIdToOutputsMap[fromComId] = {}
    }

    let comOutputs = comOutputsMap[outputId]

    if (!comOutputs) {
      comOutputs = comOutputsMap[outputId] = []
    }

    comOutputs.push({
      comId: toComId,
      pinId: inputId
    })

    if (!executeComIdToInputCountMap[toComId]) {
      executeComIdToInputCountMap[toComId] = 1
    } else {
      executeComIdToInputCountMap[toComId] = executeComIdToInputCountMap[toComId] + 1
    }
  })

  const { comId, pinId } = starter
  const component = coms[comId]

  /** 需要等待的组件输入列表 */
  const promiseComponentsMap: {[key: string]: Array<string>} = {}

  const generateNextEventCode = (
    nexts: Array<{comId: string, pinId: string}> | {comId: string, pinId: string},
    { executeIdToOutputsMap, executeComIdToInputCountMap }: { executeIdToOutputsMap: {[key: string]: {[key: string]: Array<{comId: string,pinId: string}>}}, executeComIdToInputCountMap: {[key: string]: number} }
  ): string => {
    if (Array.isArray(nexts)) {
      return nexts.map(({ comId, pinId }) => {
        const waitForInputs = executeComIdToInputCountMap[comId] > 1

        if (waitForInputs) {
          if (!promiseComponentsMap[comId]) {
            promiseComponentsMap[comId] = [pinId]
          } else {
            promiseComponentsMap[comId].push(pinId)
          }
          return `${comId}_${convertToUnderscore(pinId)}.resolve(value)`
        }

        const component = coms[comId]
        const componentOutputs = executeIdToOutputsMap[comId]
        if (!componentOutputs) {
          /** 没有下一步，直接执行就结束了 */
          const {
            importComponent,
            filePath,
            componentCode,
          } = generateJsComponentCode({
            comId: comId,
            filePath: parentFilePath,
            scene
          }, { inputs: [pinId], outputs: [] });
  
          replaceImportComponent =
            replaceImportComponent + importComponent + "\n";
  
          tsxArray.push({
            code: componentCode,
            filePath,
          });
          return `
            /** ${component.title} */
            render_${convertToUnderscore(component.def.namespace)}_${comId}(value)
          `
        }
        const outputIds = Object.keys(componentOutputs)

        const {
          importComponent,
          filePath,
          componentCode,
        } = generateJsComponentCode({
          comId: comId,
          filePath: parentFilePath,
          scene
        }, { inputs: [pinId], outputs: outputIds });

        replaceImportComponent =
          replaceImportComponent + importComponent + "\n";

        tsxArray.push({
          code: componentCode,
          filePath,
        });
        return `
          /** ${component.title} - ${comId} */
          render_${convertToUnderscore(component.def.namespace)}_${comId}({
            ${Object.keys(componentOutputs).map((outputId) => {
              return `
                ${outputId}(value: unknown) {
                  ${generateNextEventCode(componentOutputs[outputId], { executeIdToOutputsMap, executeComIdToInputCountMap })}
                }
              `
            })}
          })(value)
        `
      }).join('\n')
    } else {
      const { comId, pinId } = nexts
      const waitForInputs = executeComIdToInputCountMap[comId] > 1

      if (waitForInputs) {
        if (!promiseComponentsMap[comId]) {
          promiseComponentsMap[comId] = [pinId]
        } else {
          promiseComponentsMap[comId].push(pinId)
        }
        return `${comId}_${convertToUnderscore(pinId)}.resolve`
      }
      const component = coms[comId]
      const componentOutputs = executeIdToOutputsMap[comId]

      if (!componentOutputs) {
        /** 没有下一步，直接执行就结束了 */
        const {
          importComponent,
          filePath,
          componentCode,
        } = generateJsComponentCode({
          comId: comId,
          filePath: parentFilePath,
          scene
        }, { inputs: [pinId], outputs: [] });

        replaceImportComponent =
          replaceImportComponent + importComponent + "\n";

        tsxArray.push({
          code: componentCode,
          filePath,
        });
        return `
          /** ${component.title} */
          render_${convertToUnderscore(component.def.namespace)}_${comId}
        `
      }

      const outputIds = Object.keys(componentOutputs)

      // 开分支
      const {
        importComponent,
        filePath,
        componentCode,
      } = generateJsComponentCode({
        comId: comId,
        filePath: parentFilePath,
        scene
      }, { inputs: [pinId], outputs: outputIds });

      replaceImportComponent =
        replaceImportComponent + importComponent + "\n";

      tsxArray.push({
        code: componentCode,
        filePath,
      });

      return `
        /** ${component.title} - ${comId} */
        render_${convertToUnderscore(component.def.namespace)}_${comId}({
          ${Object.keys(componentOutputs).map((outputId) => {
            return `
              ${outputId}(value: unknown) {
                ${generateNextEventCode(componentOutputs[outputId], { executeIdToOutputsMap, executeComIdToInputCountMap })}
              }
            `
          })}
        })
      `
    }
  }

  const eventCode = generateNextEventCode(executeIdToOutputsMap[starter.comId][starter.pinId], { executeIdToOutputsMap, executeComIdToInputCountMap })
  const functionCode = `
      /** ${component.title} - ${comId} - ${pinId} 事件 */
      function render_${convertToUnderscore(component.def.namespace)}_${comId}_${pinId}(value: unknown) {
        ${Object.keys(promiseComponentsMap).map((comId) => {
          const waitInputs = promiseComponentsMap[comId]

          return waitInputs.map((inputId) => {
            return `const ${comId}_${convertToUnderscore(inputId)} = createPromise();`
          }).join("\n")
        })}
        ${eventCode}

        ${Object.keys(promiseComponentsMap).map((comId) => {
          const component = coms[comId]
          const waitInputs = promiseComponentsMap[comId]
          const componentOutputs = executeIdToOutputsMap[comId]
          const outputIds = Object.keys(componentOutputs)

          const {
            importComponent,
            filePath,
            componentCode,
          } = generateJsComponentCode({
            comId: comId,
            filePath: parentFilePath,
            scene
          }, { inputs: waitInputs, outputs: outputIds });
  
          replaceImportComponent =
            replaceImportComponent + importComponent + "\n";
  
          tsxArray.push({
            code: componentCode,
            filePath,
          });

          const nextCode = `
            /** ${component.title} - ${comId} */
            render_${convertToUnderscore(component.def.namespace)}_${comId}({
              ${Object.keys(componentOutputs).map((outputId) => {
                return `
                  ${outputId}(value: unknown) {
                    ${generateNextEventCode(componentOutputs[outputId], { executeIdToOutputsMap, executeComIdToInputCountMap })}
                  }
                `
              })}
            })
          `

          useAsyncPipe = true

          return `
            asyncPipe(
              /** 等待 ${component.title} 多输入到达 */
              Promise.all([${waitInputs.map((inputId) => {
                return `${comId}_${convertToUnderscore(inputId)}`
              }).join()}]),
              ${nextCode}
            )();
          `
        })}
        
      }
  `
  return {
    codeAry: tsxArray,
    functionCode,
    importComponent: replaceImportComponent,
    useAsyncPipe
  }
}