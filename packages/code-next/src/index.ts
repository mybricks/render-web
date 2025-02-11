import * as CSS from "csstype";

import { deepObjectDiff } from "./utils";

interface Style extends CSS.Properties {
  layout: "smart";
}

interface Def {
  namespace: string;
  version: string;
  rtType?: "js" | "js-autorun";
}

interface Com {
  id: string;
  name: string;
  def: Def;
  slots?: Record<string, Slot>;
}

interface Dom {
  id: string;
  style: Style;
  elements: Array<Dom | Com>;
}

interface Slot {
  id: string;
  comAry: Com[];
  layoutTemplate: Array<Dom | Com>;
  style: Style;
  type?: "scope";
}

interface ComInfo {
  id: string;
  title: string;
  def: Def;
  model: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>;
    style: Style;
    outputEvents: Record<
      string,
      {
        active: boolean;
        type: "defined";
        options: {
          id: string;
        };
      }[]
    >;
  };
  outputs: string[];
  inputs: string[];
  ioProxy: {
    id: string;
  };
  asRoot?: boolean;
  /** 判断全局变量 */
  global?: boolean;
}

interface Scene {
  id: string;
  title: string;
  slot: Slot;
  coms: Record<string, ComInfo>;
  pinRels: Record<string, string[]>;
  deps: Def[];
  comsAutoRun: Record<string, { id: string }[]>;
  type: "normal" | "popup" | "module"; // 默认页面 | 弹窗 | 模块
  pinProxies: Record<
    string,
    {
      frameId: string;
      pinId: string;
    }
  >;
  pinValueProxies: Record<
    string,
    {
      frameId: string;
      pinId: string;
      type: "frame";
    }
  >;
  inputs: {
    type: "normal" | "config";
    pinId: string;
  }[];
  outputs: {
    id: string;
    title: string;
  }[];
}

interface DiagramCon {
  id: string;
  from: {
    id: string;
    title: string;
    parent: {
      id: string;
    };
  };
  to: {
    id: string;
    title: string;
    parent: {
      id: string;
      type: "frame" | "com";
    };
    type?: "ext"; // 目前用于表示ui组件的作用域插槽的扩展输入项
  };
  finishPinParentKey?: string;
  startPinParentKey?: string;
}

interface Diagram {
  id: string;
  title: string;
  starter: {
    comId: string;
    frameId: string;
    pinId: string;
    pinAry: {
      id: string;
      title: string;
      type: "normal" | "ext" | "config"; // 输入 | 扩展输入 ｜ 配置项
    }[];
    type: "com" | "frame" | "var";
  };
  conAry: DiagramCon[];
}

interface Frame {
  id: string;
  title: string;
  diagrams: Diagram[];
  frames: Frame[];
  inputs: {
    type: "normal" | "config";
    pinId: string;
  }[];
  outputs: {
    id: string;
    title: string;
  }[];
  coms: Record<string, Frame>;
  type: "fx" | "com" | "global" | "globalFx";
}

interface Global {
  fxFrames: Scene[];
  comsReg: Record<string, ComInfo>;
}

interface ToJSON {
  frames: Frame[];
  scenes: Scene[];
  global: Global;
  modules: Record<
    string,
    {
      id: string;
      json: Scene;
      title: string;
    }
  >;
}

interface Config {
  /** 组件namespace到元数据的映射 */
  namespaceToMetaDataMap: Record<
    string,
    {
      /** 对应包名 */
      npmPackageName: string;
      /** 组件默认数据源 */
      defaultData: object;
    }
  >;
  /** 拆分场景、模块、全局变量、全局FX */
  splitModules: boolean;
}

const toCode = (tojson: ToJSON, config: Config) => {
  const { frames, scenes, global, modules } = tojson;
  const { namespaceToMetaDataMap, splitModules } = config;

  if (splitModules) {
    /** 返回结果 */
    const result: { path: string; content: string }[] = [];
    /** 记录主入口导入的依赖 */
    const mainDependencyImport: Record<string, Set<string>> = {};
    // [TODO] 马上做这个功能
    mainDependencyImport["react"] = new Set();
    mainDependencyImport["react"].add("useMemo");
    mainDependencyImport["@mybricks/render-react-hoc"] = new Set();
    ["Provider", "useCanvasState"].forEach((v) =>
      mainDependencyImport["@mybricks/render-react-hoc"].add(v),
    );
    mainDependencyImport["./canvas"] = new Set();

    // -- 区分不同类型的Frame --
    /** 全局变量的Frame */
    let globalVarFrames = null as unknown as Frame;
    const canvasFrames: Frame[] = [];
    const globalFxFrames: Frame[] = [];

    frames.forEach((frame) => {
      if (frame.type === "global") {
        globalVarFrames = frame;
      } else if (frame.type === "globalFx") {
        globalFxFrames.push(frame);
      } else {
        canvasFrames.push(frame);
      }
    });

    // -- 处理场景 --
    let canvasRender = "";
    let canvasState = "";
    let canvasIndex = "";
    scenes.forEach((scene, index) => {
      /** 记录导入的依赖 */
      const dependencyImport: Record<string, Set<string>> = {};
      dependencyImport["react"] = new Set();
      dependencyImport["@mybricks/render-react-hoc"] = new Set();
      dependencyImport["../module"] = new Set();
      // 找到对应的scene对应的frame
      const frame = canvasFrames.find((frame) => frame.id === scene.id);
      const code = new Code(
        scene,
        {
          ...frame!,
          frames: frame!.frames.concat(globalFxFrames),
        },
        global,
        {
          comsAutoRunKey: "_rootFrame_",
          sceneFrame: {
            ...frame!,
            frames: frame!.frames.concat(globalFxFrames),
          },
          dependencyImport,
          namespaceToMetaDataMap,
        },
      );
      const { ui, js } = code.toCode();

      // collectComponentDependencies(scene.deps, dependencyImport, {
      //   namespaceToMetaDataMap,
      // });

      const isPopup = validateScenePopup(scene);

      result.push({
        path: `canvas/Canvas_${scene.id}.tsx`,
        content: `${generateImportDependenciesCode(dependencyImport)}
        // ${scene.title}
        const Canvas_${scene.id} = ({${isPopup ? "" : ` visible,`} global }) => {
          ${js}
    
          return ${ui}
        }
        
        export default Canvas_${scene.id};`,
      });

      canvasIndex += `export { default as Canvas_${scene.id} } from "./Canvas_${scene.id}";`;

      mainDependencyImport["./canvas"].add(`Canvas_${scene.id}`);

      canvasRender += `{canvasState.${scene.id}.mounted && (
        <Canvas_${scene.id} ${isPopup ? "" : `visible={canvasState.${scene.id}.visible}`} global={global}/>
      )}`;

      canvasState += `${scene.id}: {
        mounted: ${index === 0 ? "true" : "false"},
        visible: ${index === 0 ? "true" : "false"},
        type: "${scene.type}",
      },`;
    });

    canvasState = `const [canvasState, canvasIO] = useCanvasState({
      ${canvasState}
    })`;

    result.push({
      path: "canvas/index.ts",
      content: canvasIndex,
    });

    // -- 处理模块 --
    let moduleIndex = "";

    if (modules) {
      Object.entries(modules).forEach(([, { json: scene }]) => {
        /** 记录导入的依赖 */
        const dependencyImport: Record<string, Set<string>> = {};
        dependencyImport["react"] = new Set();
        dependencyImport["react"].add("forwardRef");
        dependencyImport["@mybricks/render-react-hoc"] = new Set();
        dependencyImport["@mybricks/render-react-hoc"].add("Module");
        dependencyImport["../module"] = new Set();
        // 找到对应的scene对应的frame
        const frame = canvasFrames.find((frame) => frame.id === scene.id);
        const code = new Code(
          scene,
          {
            ...frame!,
            frames: frame!.frames.concat(globalFxFrames),
          },
          global,
          {
            comsAutoRunKey: "_rootFrame_",
            sceneFrame: {
              ...frame!,
              frames: frame!.frames.concat(globalFxFrames),
            },
            namespaceToMetaDataMap,
            dependencyImport,
          },
        );
        const { ui, js } = code.toCode();

        // collectComponentDependencies(scene.deps, dependencyImport, {
        //   namespaceToMetaDataMap,
        // });

        const rels = Object.entries(scene.pinRels)
          .filter(([key]) => {
            return key.startsWith("_rootFrame_");
          })
          .reduce((rels, [, value]) => {
            value.forEach((v) => rels.add(v));
            return rels;
          }, new Set());

        const eventsCode = scene.outputs
          .filter(({ id }) => {
            return id !== "click" && !rels.has(id);
          })
          .reduce((pre, { id }) => {
            return pre + id + ",";
          }, "");

        result.push({
          path: `module/Module_${scene.id}.tsx`,
          content: `${generateImportDependenciesCode(dependencyImport)}
            // ${scene.title}
            const Module_${scene.id} = forwardRef(({ global, data, ${eventsCode} ...config }, ref) => {
              ${js}

              return (
                <Module ref={ref} {...config}>
                  ${ui}
                </Module>
              )
            })
              
            export default Module_${scene.id};`,
        });

        moduleIndex += `export { default as Module_${scene.id} } from "./Module_${scene.id}";`;
      });

      if (moduleIndex) {
        result.push({
          path: "module/index.ts",
          content: moduleIndex,
        });
      }
    }

    // -- 处理全局变量 --
    let varIndex = "";
    let varGlobal = "";

    if (globalVarFrames && globalVarFrames.diagrams.length) {
      mainDependencyImport["./var"] = new Set();
      globalVarFrames.diagrams.forEach((diagram) => {
        /** 记录导入的依赖 */
        const dependencyImport: Record<string, Set<string>> = {};
        dependencyImport["@mybricks/render-react-hoc"] = new Set();
        dependencyImport["@mybricks/render-react-hoc"].add("createVar");
        const code = new Code(
          scenes[0],
          { ...globalVarFrames, diagrams: [diagram] }!,
          global,
          {
            comsAutoRunKey: "",
            ignoreUI: true,
            namespaceToMetaDataMap,
            dependencyImport: dependencyImport, // [TODO] 临时，下一版移出去
          },
        );
        const { js } = code.toCode();

        result.push({
          path: `var/var_${diagram.starter.comId}.ts`,
          content: `${generateImportDependenciesCode(dependencyImport)}
            ${js}
            
            export default var_${diagram.starter.comId};`,
        });

        varIndex =
          varIndex += `export { default as var_${diagram.starter.comId} } from "./var_${diagram.starter.comId}";`;

        const comInfo = global.comsReg[diagram.starter.comId];

        varGlobal += `${diagram.starter.comId}: var_${diagram.starter.comId}(global, ${"initValue" in comInfo.model.data ? JSON.stringify(comInfo.model.data.initValue) : "undefined"}),`;

        mainDependencyImport["./var"].add(`var_${diagram.starter.comId}`);
      });

      result.push({
        path: "var/index.ts",
        content: varIndex,
      });
    }

    // -- 处理全局FX -- [TODO] 拆文件
    let fxIndex = "";
    let fxGlobal = "";

    if (globalFxFrames.length) {
      mainDependencyImport["./fx"] = new Set();
      globalFxFrames.forEach((frame) => {
        /** 记录导入的依赖 */
        const dependencyImport: Record<string, Set<string>> = {};
        const scene = global.fxFrames.find(
          (fxFrame) => fxFrame.id === frame.id,
        );
        // collectComponentDependencies(scene!.deps, mainDependencyImport, {
        //   // [TODO] 临时，下一版移出去
        //   namespaceToMetaDataMap,
        // });
        const code = new Code(scene!, frame, global, {
          comsAutoRunKey: "",
          ignoreUI: true,
          namespaceToMetaDataMap,
          dependencyImport,
        });

        const { js } = code.toCode();

        result.push({
          path: `fx/fx_${frame.id}.ts`,
          content: `${generateImportDependenciesCode(dependencyImport)}
            ${js}

            export default fx_${frame.id};
          `,
        });

        fxGlobal = fxGlobal + `${frame.id}: fx_${frame.id}(global),`;

        fxIndex =
          fxIndex += `export { default as fx_${frame.id} } from "./fx_${frame.id}";`;

        mainDependencyImport["./fx"].add(`fx_${frame.id}`);
      });

      result.push({
        path: "fx/index.ts",
        content: fxIndex,
      });
    }

    // -- 处理主入口 --
    result.push({
      path: "index.tsx",
      content: `${generateImportDependenciesCode(mainDependencyImport)}

      export default function () {
        ${canvasState}

        const global = useMemo(() => {
          const global = {
            fx: {},
            var: {},
            canvas: canvasIO,
          };
          global.fx = {${fxGlobal}};
          global.var = {${varGlobal}};
          return global;
        }, [])

        const value = useMemo(() => {
          return {
            env: {
              runtime: true,
              i18n: (value) => value,
            },
            canvasState,
            canvasIO
          };
        }, []);

        return (
          <Provider value={value}>
            ${canvasRender}
          </Provider>
        )
      }
      `,
    });

    return result;
  }

  // let canvasDeclaration = "";
  // let canvasRender = "";
  // let canvasState = "";

  // const dependencyImport: Record<string, Set<string>> = {};

  // global.fxFrames.forEach((fxFrame) => {
  //   collectComponentDependencies(fxFrame.deps, dependencyImport, {
  //     namespaceToMetaDataMap,
  //   });
  // });

  // let globalVarFrames = null as unknown as Frame;
  // const canvasFrames: Frame[] = [];
  // const globalFxFrames: Frame[] = [];

  // frames.forEach((frame) => {
  //   if (frame.type === "global") {
  //     globalVarFrames = frame;
  //   } else if (frame.type === "globalFx") {
  //     globalFxFrames.push(frame);
  //   } else {
  //     canvasFrames.push(frame);
  //   }
  // });

  // scenes.forEach((scene, index) => {
  //   // 找到对应的scene对应的frame
  //   const frame = canvasFrames.find((frame) => frame.id === scene.id);
  //   const code = new Code(
  //     scene,
  //     {
  //       ...frame!,
  //       frames: frame!.frames.concat(globalFxFrames),
  //     },
  //     global,
  //     {
  //       comsAutoRunKey: "_rootFrame_",
  //       sceneFrame: {
  //         ...frame!,
  //         frames: frame!.frames.concat(globalFxFrames),
  //       },
  //       namespaceToMetaDataMap,
  //     },
  //   );
  //   const { ui, js } = code.toCode();

  //   collectComponentDependencies(scene.deps, dependencyImport, {
  //     namespaceToMetaDataMap,
  //   });

  //   const isPopup = validateScenePopup(scene);

  //   canvasDeclaration += `// ${scene.title}
  //   const Canvas_${scene.id} = ({${isPopup ? "" : ` visible,`} global }) => {
  //     ${js}

  //     return ${ui}
  //   }
  //   \n`;

  //   canvasRender += `{canvasState.${scene.id}.mounted && (
  //     <Canvas_${scene.id} ${isPopup ? "" : `visible={canvasState.${scene.id}.visible}`} global={global}/>
  //   )}`;

  //   canvasState += `${scene.id}: {
  //     mounted: ${index === 0 ? "true" : "false"},
  //     visible: ${index === 0 ? "true" : "false"},
  //     type: "${scene.type}",
  //   },`;
  // });

  // canvasState = `const [canvasState, canvasIO] = useCanvasState({
  //   ${canvasState}
  // })`;

  // let varDeclaration = "";
  // let varGlobal = "";

  // if (globalVarFrames && globalVarFrames.diagrams.length) {
  //   globalVarFrames.diagrams.forEach((diagram) => {
  //     varGlobal =
  //       varGlobal + `${diagram.starter.comId}: var_${diagram.starter.comId},`;
  //   });
  //   const code = new Code(scenes[0], globalVarFrames!, global, {
  //     comsAutoRunKey: "",
  //     ignoreUI: true,
  //     namespaceToMetaDataMap,
  //   });
  //   const { js } = code.toCode();

  //   varDeclaration = js;
  // }

  // let fxDeclaration = "";
  // let fxGlobal = "";

  // if (globalFxFrames.length) {
  //   globalFxFrames.forEach((frame) => {
  //     fxGlobal = fxGlobal + `${frame.id}: fx_${frame.id},`;
  //     const code = new Code(
  //       global.fxFrames.find((fxFrame) => fxFrame.id === frame.id)!,
  //       frame,
  //       global,
  //       {
  //         comsAutoRunKey: "",
  //         ignoreUI: true,
  //         namespaceToMetaDataMap,
  //       },
  //     );

  //     const { js } = code.toCode();
  //     fxDeclaration = js;
  //   });
  // }

  // /** 模块声明 */
  // let moduleDeclaration = "";

  // if (modules) {
  //   Object.entries(modules).forEach(([, { json: scene }]) => {
  //     // 找到对应的scene对应的frame
  //     const frame = canvasFrames.find((frame) => frame.id === scene.id);
  //     const code = new Code(
  //       scene,
  //       {
  //         ...frame!,
  //         frames: frame!.frames.concat(globalFxFrames),
  //       },
  //       global,
  //       {
  //         comsAutoRunKey: "_rootFrame_",
  //         sceneFrame: {
  //           ...frame!,
  //           frames: frame!.frames.concat(globalFxFrames),
  //         },
  //         namespaceToMetaDataMap,
  //       },
  //     );
  //     const { ui, js } = code.toCode();

  //     collectComponentDependencies(scene.deps, dependencyImport, {
  //       namespaceToMetaDataMap,
  //     });

  //     const rels = Object.entries(scene.pinRels)
  //       .filter(([key]) => {
  //         return key.startsWith("_rootFrame_");
  //       })
  //       .reduce((rels, [, value]) => {
  //         value.forEach((v) => rels.add(v));
  //         return rels;
  //       }, new Set());

  //     const eventsCode = scene.outputs
  //       .filter(({ id }) => {
  //         return id !== "click" && !rels.has(id);
  //       })
  //       .reduce((pre, { id }) => {
  //         return pre + id + ",";
  //       }, "");

  //     moduleDeclaration += `// ${scene.title}
  //     const Module_${scene.id} = forwardRef(({ global, data, ${eventsCode} ...config }, ref) => {
  //       ${js}

  //       return (
  //         <Module ref={ref} {...config}>
  //           ${ui}
  //         </Module>
  //       )
  //     })
  //     \n`;
  //   });
  // }

  // const dependencyImportCode = Object.entries(dependencyImport).reduce(
  //   (pre, cur) => {
  //     const [npm, dependency] = cur;
  //     return (
  //       pre + `import { ${Array.from(dependency).join(", ")} } from "${npm}";`
  //     );
  //   },
  //   "",
  // );

  // return `import React, { useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from "react"
  //     ${dependencyImportCode}
  //     import { Provider, Slot, Module, join, merge, inputs, useVar, useCanvasState } from "@mybricks/render-react-hoc";

  //     export default function () {
  //       ${canvasState}

  //       ${varDeclaration}

  //       ${fxDeclaration}

  //       const global = useMemo(() => {
  //         return {
  //           var: {${varGlobal}},
  //           fx: {${fxGlobal}},
  //           canvas: canvasIO
  //         }
  //       }, [])

  //       const value = useMemo(() => {
  //         return {
  //           env: {
  //             runtime: true,
  //             i18n: (value) => value,
  //           },
  //           canvasState,
  //           canvasIO
  //         };
  //       }, []);

  //       return (
  //         <Provider value={value}>
  //           ${canvasRender}
  //         </Provider>
  //       )
  //     }

  //     ${canvasDeclaration}

  //     ${moduleDeclaration}
  //     `;
};

class Code {
  // ref声明
  refs: Set<string> = new Set();

  // 变量声明
  vars: Set<string> = new Set();

  constructor(
    private scene: Scene,
    private frame: Frame,
    private global: Global,
    private config: {
      comsAutoRunKey: string;
      namespaceToMetaDataMap: Record<
        string,
        {
          /** 对应包名 */
          npmPackageName: string;
          /** 组件默认数据源 */
          defaultData: object;
        }
      >;
      dependencyImport: Record<string, Set<string>>;
      ignoreUI?: boolean;
      sceneFrame?: Frame;
    },
  ) {}

  handleFrame() {
    const nextCode: string[] = [];

    if (!this.config.ignoreUI) {
      this.frame.frames.forEach(({ diagrams, inputs, type }) => {
        if (type === "globalFx") {
          return;
        }
        nextCode.push(this.handleDiagram(diagrams[0], { inputs, type })); // inputs, 用于frame-input组件，判断当前是fx是需要计算获取的是第几个参数
      });
    }

    this.frame.diagrams.forEach((diagram) => {
      nextCode.push(this.handleDiagram(diagram, { type: this.frame.type }));
    });

    return (
      Array.from(this.refs).join("\n") +
      (this.refs.size > 1 ? "\n\n" : "\n") +
      Array.from(this.vars).join("\n") +
      nextCode.filter((c) => c).join("\n\n")
    );
  }

  handleDiagram(
    diagram: Diagram,
    {
      inputs,
      type,
    }: {
      inputs?: {
        type: "normal" | "config";
        pinId: string;
      }[];
      type?: string;
    },
  ) {
    const { starter, conAry } = diagram;

    if (
      diagram.starter.type === "frame" &&
      diagram.starter.frameId === this.scene.id &&
      type !== "globalFx"
    ) {
      // useEffect 卡片 main
      // 一定只有一个输入，后续有多个输入的话再看下
      // const startNodes = conAry.filter(
      //   (con) => con.from.parent.id === starter.frameId,
      // );

      // 自执行组件
      const comsAutoRun = this.scene.comsAutoRun[this.config.comsAutoRunKey];

      // 节点声明
      const nodesDeclaration = new Set<string>();

      // 节点调用
      const nodesInvocation = new Set<string>();

      // 记录多输入，当全部到达后，写入代码
      const multipleInputsNodes: Record<
        string,
        {
          step: number[];
          value: string[];
          inputsTitle: string[];
        }
      > = {};

      const res = starter.pinAry.reduce((cur, { id, type }) => {
        const startNodes = conAry.filter(
          (con) => con.from.id === id && con.from.parent.id === starter.frameId,
        );

        const res = this.handleDiagramNext({
          startNodes,
          diagram,
          defaultValue:
            this.scene.type === "module" // 区分模块和场景
              ? type === "config"
                ? `data.${id}`
                : `ref.current.inputs.${id}`
              : `global.canvas.${this.scene.id}.inputs.${id}`,
          nextStep: cur,
          nodesDeclaration,
          nodesInvocation,
          multipleInputsNodes,
          notesIndex: cur,
          frameOutputs: {},
          type,
        });

        return res.nextStep + startNodes.length;
      }, 0);

      // const res = this.handleDiagramNext({
      //   startNodes,
      //   diagram,
      //   defaultValue: `global.canvas.${this.scene.id}.inputs.open`,
      //   nextStep: startNodes.length - 1,
      //   nodesDeclaration,
      //   nodesInvocation,
      //   multipleInputsNodes,
      //   notesIndex: 0,
      //   frameOutputs: {},
      //   inputs,
      //   type,
      // });

      if (comsAutoRun) {
        comsAutoRun.reduce((cur, pre) => {
          const startNodes = conAry.filter(
            (con) => con.from.parent.id === pre.id,
          );

          const res = this.handleDiagramNext({
            startNodes: [
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
                    id: pre.id,
                    type: "com",
                  },
                },
              },
            ],
            diagram,
            defaultValue: "",
            nextStep: cur + startNodes.length,
            nodesDeclaration,
            nodesInvocation,
            multipleInputsNodes,
            notesIndex: 0,
            frameOutputs: {},
            type,
          });

          return res.nextStep;
        }, res);
      }

      if (res || comsAutoRun) {
        // this.config.dependencyImport["react"].add("useEffect");

        collectImportDependencies(this.config.dependencyImport, {
          packageName: "react",
          dependencyName: "useEffect",
        });
      }

      return res || comsAutoRun
        ? `useEffect(() => {
      ${nodesDeclaration.size ? "// 节点声明" : ""}
      ${Array.from(nodesDeclaration).join("\n")}

      ${Array.from(nodesInvocation).join("\n\n")}
      }, [])`
        : "";
    } else if (
      diagram.starter.type === "frame" &&
      (type === "fx" || type === "globalFx")
    ) {
      // fx

      // 节点声明
      const nodesDeclaration = new Set<string>();

      // 节点调用
      const nodesInvocation = new Set<string>();

      // 记录多输入，当全部到达后，写入代码
      const multipleInputsNodes: Record<
        string,
        {
          step: number[];
          value: string[];
          inputsTitle: string[];
        }
      > = {};

      // 记录卡片的输出 frameId => outputId => next
      const frameOutputs: Record<string, Set<string>> = {};

      starter.pinAry.reduce((cur, { id }, index) => {
        const startNodes = conAry.filter(
          (con) => con.from.id === id && con.from.parent.id === starter.frameId,
        );

        const res = this.handleDiagramNext({
          startNodes,
          diagram,
          defaultValue: `value${index}`,
          nextStep: cur,
          nodesDeclaration,
          nodesInvocation,
          multipleInputsNodes,
          notesIndex: cur,
          frameOutputs,
          inputs,
          type,
        });

        return res.nextStep + startNodes.length;
      }, 0);

      const frame =
        type === "globalFx"
          ? this.global.fxFrames.find(
              (fxFrames) => fxFrames.id === starter.frameId,
            )
          : this.frame.frames.find((frame) => {
              return frame.id === starter.frameId;
            });

      const fxBody = `(${starter.pinAry.map((_, index) => `value${index}`).join(", ")}) => {
        ${nodesDeclaration.size ? "// 节点声明" : ""}
        ${Array.from(nodesDeclaration).join("\n")}

        ${Array.from(nodesInvocation).join("\n\n")}

        ${
          frame!.outputs.length
            ? `return [${frame!.outputs.reduce((pre, { id, title }) => {
                const outputs = frameOutputs[id];

                if (outputs?.size) {
                  if (outputs.size > 1) {
                    this.config.dependencyImport[
                      "@mybricks/render-react-hoc"
                    ].add("merge");
                  }
                  return (
                    pre +
                    `\n// ${title}
                  ${outputs.size > 1 ? `merge(${Array.from(outputs).join(", ")})` : Array.from(outputs)[0]},`
                  );
                }

                return pre;
              }, "")}
          ]`
            : ""
        }
      }`;

      if (type === "globalFx") {
        return `// ${frame!.title}
          const fx_${starter.frameId} = (global) => {
            return ${fxBody}
          }
        `;
      } else {
        return `// ${frame!.title}
          const fx_${starter.frameId} = ${fxBody}
        `;
      }

      // return `// ${frame!.title}
      // const fx_${starter.frameId} = (${starter.pinAry.map((_, index) => `value${index}`).join(", ")}) => {
      // ${nodesDeclaration.size ? "// 节点声明" : ""}
      // ${Array.from(nodesDeclaration).join("\n")}

      // ${Array.from(nodesInvocation).join("\n\n")}

      // ${
      //   frame!.outputs.length
      //     ? `return [${frame!.outputs.reduce((pre, { id, title }) => {
      //         const outputs = frameOutputs[id];

      //         if (outputs?.size) {
      //           if (outputs.size > 1) {
      //             this.config.dependencyImport[
      //               "@mybricks/render-react-hoc"
      //             ].add("merge");
      //           }
      //           return (
      //             pre +
      //             `\n// ${title}
      //           ${outputs.size > 1 ? `merge(${Array.from(outputs).join(", ")})` : Array.from(outputs)[0]},`
      //           );
      //         }

      //         return pre;
      //       }, "")}
      //   ]`
      //     : ""
      // }
      // }`;
    } else if (diagram.starter.type === "frame" && this.frame.type === "com") {
      // 组件的作用域插槽

      // 节点声明
      const nodesDeclaration = new Set<string>();

      // 节点调用
      const nodesInvocation = new Set<string>();

      // 记录多输入，当全部到达后，写入代码
      const multipleInputsNodes: Record<
        string,
        {
          step: number[];
          value: string[];
          inputsTitle: string[];
        }
      > = {};

      const res = starter.pinAry.reduce((cur, { id }) => {
        const startNodes = conAry.filter(
          (con) => con.from.id === id && con.from.parent.id === starter.frameId,
        );

        const res = this.handleDiagramNext({
          startNodes,
          diagram,
          defaultValue: `slot.${id}`,
          nextStep: cur,
          nodesDeclaration,
          nodesInvocation,
          multipleInputsNodes,
          notesIndex: cur,
          frameOutputs: {},
          type,
        });

        return res.nextStep + startNodes.length;
      }, 0);

      // 自执行组件
      const comsAutoRun = this.scene.comsAutoRun[this.config.comsAutoRunKey];

      if (comsAutoRun) {
        comsAutoRun.reduce((cur, pre) => {
          const startNodes = conAry.filter(
            (con) => con.from.parent.id === pre.id,
          );

          const res = this.handleDiagramNext({
            startNodes: [
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
                    id: pre.id,
                    type: "com",
                  },
                },
              },
            ],
            diagram,
            defaultValue: "",
            nextStep: cur + startNodes.length,
            nodesDeclaration,
            nodesInvocation,
            multipleInputsNodes,
            notesIndex: 0,
            frameOutputs: {},
            type,
          });

          return res.nextStep;
        }, res);
      }

      if (nodesInvocation.size || comsAutoRun) {
        collectImportDependencies(this.config.dependencyImport, {
          packageName: "react",
          dependencyName: "useEffect",
        });
      }

      return nodesInvocation.size || comsAutoRun
        ? `useEffect(() => {
      ${nodesDeclaration.size ? "// 节点声明" : ""}
      ${Array.from(nodesDeclaration).join("\n")}

      ${Array.from(nodesInvocation).join("\n\n")}
      }, [])`
        : "";
    } else {
      // 组件事件卡片或者变量，只有一个输入
      const startNodes = conAry.filter(
        (con) =>
          con.from.id === starter.pinId && con.from.parent.id === starter.comId,
      );

      const toComInfo = this.scene.coms[starter.comId];

      if (!toComInfo) {
        console.warn("找不到对应的组件信息 => ", starter);
        return "";
      }

      const componentName = validateUiModule(toComInfo.def.namespace)
        ? `Module_${toComInfo.model.data.definedId}` // 模块特殊命名方式（内置组件）
        : generateComponentNameByDef(toComInfo.def);

      if (validateUiModule(toComInfo.def.namespace)) {
        // this.config.dependencyImport["../module"].add(
        //   `Module_${toComInfo.model.data.definedId}`,
        // );
        collectImportDependencies(this.config.dependencyImport, {
          packageName: "../module",
          dependencyName: `Module_${toComInfo.model.data.definedId}`,
        });
      }

      // 节点声明
      const nodesDeclaration = new Set<string>();

      // 节点调用
      const nodesInvocation = new Set<string>();

      // 记录多输入，当全部到达后，写入代码
      const multipleInputsNodes: Record<
        string,
        {
          step: number[];
          value: string[];
          inputsTitle: string[];
        }
      > = {};

      this.handleDiagramNext({
        startNodes,
        diagram,
        defaultValue: "value",
        nextStep: startNodes.length - 1, // [TODO] 或者是把相同的开始节点做合并？
        // nextStep: 0,
        nodesDeclaration,
        nodesInvocation,
        multipleInputsNodes,
        notesIndex: 0,
        frameOutputs: {},
        type,
        _test: true,
      });

      // const { nodesInvocation, nodesDeclaration } = this.handleDiagramNext({
      //   startNodes,
      //   diagram,
      //   defaultValue: "value",
      // });

      if (starter.type === "var") {
        // this.config.dependencyImport["@mybricks/render-react-hoc"].add(
        //   "createVar",
        // );

        if (this.frame.type === "global") {
          // 全局变量，区别于作用域变量
          collectImportDependencies(this.config.dependencyImport, {
            packageName: "@mybricks/render-react-hoc",
            dependencyName: "createVar",
          });
          this.vars.add(`// ${diagram.title}
            const var_${toComInfo.id} = (global, defaultValue) => {
              return createVar(defaultValue, (value) => {
                ${nodesDeclaration.size ? "// 节点声明" : ""}
                ${Array.from(nodesDeclaration).join("\n")}
          
                ${Array.from(nodesInvocation).join("\n\n")}
              })
            }
            `);
        } else {
          // this.config.dependencyImport["@mybricks/render-react-hoc"].add(
          //   "useVar",
          // );
          collectImportDependencies(this.config.dependencyImport, {
            packageName: "@mybricks/render-react-hoc",
            dependencyName: "useVar",
          });
          this.vars.add(`// ${diagram.title}
            const var_${toComInfo.id} = useVar(${"initValue" in toComInfo.model.data ? JSON.stringify(toComInfo.model.data.initValue) : "undefined"}, (value) => {
            ${nodesDeclaration.size ? "// 节点声明" : ""}
            ${Array.from(nodesDeclaration).join("\n")}
      
            ${Array.from(nodesInvocation).join("\n\n")}
            });
          `);
        }

        return "";

        // this.config.dependencyImport["@mybricks/render-react-hoc"].add(
        //   "useVar",
        // );
        // this.vars.add(`// ${diagram.title}
        // const var_${toComInfo.id} = useVar(${"initValue" in toComInfo.model.data ? JSON.stringify(toComInfo.model.data.initValue) : "undefined"}, (value) => {
        // ${nodesDeclaration.size ? "// 节点声明" : ""}
        // ${Array.from(nodesDeclaration).join("\n")}

        // ${Array.from(nodesInvocation).join("\n\n")}
        // });
        // `);

        // return "";
      }

      return `// ${diagram.title}
      const ${componentName}_${starter.comId}_${starter.pinId} = (value) => {
        ${nodesDeclaration.size ? "// 节点声明" : ""}
        ${Array.from(nodesDeclaration).join("\n")}
  
        ${Array.from(nodesInvocation).join("\n\n")}
      }`;
    }
  }

  handleDiagramNext({
    startNodes,
    diagram,
    defaultValue,
    nextStep,
    nodesDeclaration,
    nodesInvocation,
    multipleInputsNodes,
    notesIndex,
    frameOutputs,
    inputs,
    type, // 用于判断是否fx，主要用于调用输出时的特殊处理
    // _test,
  }: {
    startNodes: DiagramCon[];
    diagram: Diagram;
    defaultValue: string;
    nextStep: number;
    nodesDeclaration: Set<string>;
    nodesInvocation: Set<string>;
    multipleInputsNodes: Record<
      string,
      {
        step: number[];
        value: string[];
        inputsTitle: string[];
      }
    >;
    notesIndex: number;
    frameOutputs: Record<string, Set<string>>;
    inputs?: {
      type: "normal" | "config";
      pinId: string;
    }[];
    type?: string;
    _test?: boolean;
  }) {
    const { conAry } = diagram;

    const handleNext = (
      nodes: DiagramCon[],
      {
        value,
        currentNextStep,
        start,
      }: { value: string; currentNextStep: number; start: boolean },
    ) => {
      nodes.forEach((node, nodeIndex) => {
        if (node.to.parent.type === "frame") {
          if (type === "fx" || type === "globalFx") {
            // 这里说明是卡片的输出，不需要再往下走了
            if (!frameOutputs[node.to.id]) {
              frameOutputs[node.to.id] = new Set();
            }
            frameOutputs[node.to.id].add(value);
          } else if (this.scene.type === "module") {
            // 模块，区分canvas的输出
            const rels = Object.entries(this.scene.pinRels)
              .filter(([key]) => {
                return key.startsWith("_rootFrame_");
              })
              .reduce((rels, [, value]) => {
                value.forEach((v) => rels.add(v));
                return rels;
              }, new Set());

            if (rels.has(node.to.id)) {
              // 关联输出
              nodesInvocation.add(
                `// [${start ? nodeIndex : nextStep}] -> (${node.to.title}) ${this.scene.title}
                ref.current.outputs.${node.to.id}(${value});`,
              );
            } else {
              // 事件
              nodesInvocation.add(
                `// [${start ? nodeIndex : nextStep}] -> (${node.to.title}) ${this.scene.title}
                ${node.to.id}?.(${value});`,
              );
            }
          } else {
            nodesInvocation.add(
              `// [${start ? nodeIndex : nextStep}] -> (${node.to.title}) ${this.scene.title}
              global.canvas.${this.frame.id}.outputs.${node.to.id}(${value});`,
            );
          }
          return;
        }

        const toComInfo = this.scene.coms[node.to.parent.id];
        const componentName = validateUiModule(toComInfo.def.namespace)
          ? `Module_${toComInfo.model.data.definedId}` // 模块特殊命名方式（内置组件）
          : generateComponentNameByDef(toComInfo.def);

        if (validateUiModule(toComInfo.def.namespace)) {
          this.config.dependencyImport["../module"].add(
            `Module_${toComInfo.model.data.definedId}`,
          );
        }

        const isJsComponent = validateJsComponent(toComInfo.def.rtType);
        const isJsFx = validateJsFxComponent(toComInfo.def.namespace);
        const isJsVar = validateJsVarComponent(toComInfo.def.namespace);
        const isJsScenes = validateJsScenesComponent(toComInfo.def.namespace);
        const isJsFrameInputComponent = validateJsFrameInputComponent(
          toComInfo.def.namespace,
        );

        if (
          isJsComponent &&
          !isJsFx &&
          !isJsVar &&
          !isJsScenes &&
          !isJsFrameInputComponent
        ) {
          // fx 变量不需要声明节点
          nodesDeclaration.add(
            `const ${componentName}_${toComInfo.id} = ${componentName}({data: ${JSON.stringify(deepObjectDiff(this.config.namespaceToMetaDataMap[toComInfo.def.namespace].defaultData, toComInfo.model.data))}, inputs: ${JSON.stringify(toComInfo.inputs)}, outputs: ${JSON.stringify(toComInfo.outputs)}})`,
          );

          // 声明节点的一定来自组件库
          collectImportDependencies(this.config.dependencyImport, {
            packageName:
              this.config.namespaceToMetaDataMap[toComInfo.def.namespace]
                .npmPackageName,
            dependencyName: generateComponentNameByDef(toComInfo.def),
          });
        }

        nextStep++;

        const isJsMultipleInputs =
          !isJsFx && !isJsVar && toComInfo.inputs[0] // 非fx、变量并且有输入的才需要判断是否多输入
            ? validateJsMultipleInputs(toComInfo.inputs[0])
            : false;

        if (isJsMultipleInputs) {
          // 多输入，需要等待输入到达，且入参为数组
          if (!multipleInputsNodes[toComInfo.id]) {
            multipleInputsNodes[toComInfo.id] = {
              step: [],
              value: [],
              inputsTitle: [],
            };
          }
          const inputIndex = toComInfo.inputs.findIndex(
            (inputId) => inputId === node.to.id,
          );

          nextStep--;

          // multipleInputsNodes[toComInfo.id].step[inputIndex] = nextStep - 1;
          multipleInputsNodes[toComInfo.id].step[inputIndex] =
            currentNextStep + nodeIndex;
          multipleInputsNodes[toComInfo.id].value[inputIndex] = value;
          multipleInputsNodes[toComInfo.id].inputsTitle[inputIndex] =
            node.to.title;

          if (
            multipleInputsNodes[toComInfo.id].value.filter((v) => v).length !==
            toComInfo.inputs.length
          ) {
            // 输入没有完全到达，不走到下一步
            return;
          }

          nextStep++;
        }

        const nextMap: Record<
          string,
          {
            from: DiagramCon;
            conAry: DiagramCon[];
          }
        > = {};

        conAry.forEach((nextCon) => {
          if (
            nextCon.from.parent.id === toComInfo.id &&
            (isJsComponent && !isJsVar // 如果是ui、变量组件，单实例，根据finishPinParentKey和startPinParentKey来进行连接
              ? true
              : node.finishPinParentKey === nextCon.startPinParentKey)
          ) {
            if (!nextMap[nextCon.from.id]) {
              nextMap[nextCon.from.id] = {
                from: nextCon,
                conAry: [nextCon],
              };
            } else {
              nextMap[nextCon.from.id].conAry.push(nextCon);
            }
          }
        });

        const nextCode: string[] = [];

        Object.entries(nextMap).forEach(([outputId, { from }]) => {
          if (isJsComponent) {
            if (isJsVar) {
              nextCode.push(
                `${componentName}_${toComInfo.id}_${from.startPinParentKey}`,
              );
            } else if (isJsScenes) {
              nextCode.push(`${outputId}: canvas_${toComInfo.id}_${outputId}`);
            } else {
              nextCode.push(
                `${outputId}: ${componentName}_${toComInfo.id}_${outputId}`,
              );
            }
          } else {
            nextCode.push(
              `${outputId}: ${componentName}_${toComInfo.id}_${outputId}_${from.startPinParentKey}`,
            );
          }
        });

        let notes = "";

        const nextSteps: number[] = [];

        if (isJsMultipleInputs) {
          notes = `// ${multipleInputsNodes[toComInfo.id].step
            .map((i) => {
              return `[${i}]`;
            })
            .join(
              "",
            )} -> (${multipleInputsNodes[toComInfo.id].inputsTitle.join(", ")}) ${toComInfo.title}`;

          Object.entries(nextMap).forEach(([, { from, conAry }], index) => {
            notes += `\n// ${from.from.title} >> ${conAry
              .map((con) => {
                if (con.to.parent.type === "frame") {
                  return `(${con.to.title}) ${diagram.title}`;
                }
                const toComInfo = this.scene.coms[con.to.parent.id];
                nextSteps.push(nextStep + index);
                return `[${nextStep + index}] (${con.to.title}) ${toComInfo.title}`;
              })
              .join(", ")}`;
          });
        } else {
          notes = `// [${start ? nodeIndex : currentNextStep + nodeIndex}] -> (${node.to.title}) ${toComInfo.title}`;

          Object.entries(nextMap).forEach(([, { from, conAry }], nextIndex) => {
            notes += `\n// ${from.from.title} >> ${conAry
              .map((con) => {
                // [TODO] nextIndex 替换 conAry 的 index，顺序待观察
                if (con.to.parent.type === "frame") {
                  return `(${con.to.title}) ${diagram.title}`;
                }
                const toComInfo = this.scene.coms[con.to.parent.id];
                nextSteps.push(nextStep + nextIndex);
                return `[${nextStep + nextIndex}] (${con.to.title}) ${toComInfo.title}`;
              })
              .join(", ")}`;
          });
        }

        if (isJsComponent) {
          let nextInput = "";
          let nextValue = value;
          let nextId = `_${toComInfo.id}`;
          let nextComponentName = componentName;
          let destructuringAssignment = "";

          if (isJsScenes) {
            /** 第二个参数，用于打开页面判断是新还是重定向 */
            let secondValue = "";

            if (
              toComInfo.model.data._pinId === "open" &&
              toComInfo.model.data._sceneShowType !== "popup" &&
              toComInfo.model.data.openType !== "none"
            ) {
              // 调用场景为open且类型不是popup，且打开类型不为none，需要传入第二个参数
              secondValue = `, "${toComInfo.model.data.openType}"`;
            }

            nodesInvocation.add(
              notes +
                "\n" +
                `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}global.canvas.${toComInfo.model.data._sceneId}.inputs.${toComInfo.model.data._pinId}(${value}${secondValue});`,
            );
          } else if (isJsFx) {
            const frame =
              this.frame.frames.find((frame) => {
                return frame.id === toComInfo.ioProxy.id;
              }) || // 作用域插槽调用页面fx
              this.config.sceneFrame?.frames.find((frame) => {
                return frame.id === toComInfo.ioProxy.id;
              });
            const configs = toComInfo.model.data.configs;
            const params = frame!.inputs.reduce((cur, pre) => {
              if (pre.type === "config") {
                return cur + `, ${JSON.stringify(configs[pre.pinId])}`;
              }
              return cur;
            }, value);
            nextValue = params;
            nextId = `_${toComInfo.ioProxy.id}`;
            nextComponentName = "fx";

            if (nextCode.length) {
              destructuringAssignment = `const [${nextCode.map((_, index) => `${nextComponentName}_${toComInfo.id}_${index}`).join(", ")}] = `;
            }

            if (frame!.type === "globalFx") {
              nextComponentName = "global.fx.";
              nextId = toComInfo.ioProxy.id;
            }
          } else if (isJsVar) {
            nextInput = `.${node.to.id}`;
            if (nextCode.length) {
              destructuringAssignment = `const ${nextCode[0]} = `;
            }

            if (toComInfo.global) {
              // 认为是全局变量
              nextComponentName = "global.var.";
              nextId = toComInfo.id;
            }
          } else if (isJsMultipleInputs) {
            nextValue = multipleInputsNodes[toComInfo.id].value.join(", ");
            if (nextCode.length) {
              destructuringAssignment = `const {${nextCode.join(", ")}} = `;
            }
          } else if (isJsFrameInputComponent) {
            this.config.dependencyImport["@mybricks/render-react-hoc"].add(
              "join",
            );
            const pinValueProxy =
              this.scene.pinValueProxies[`${toComInfo.id}-${node.to.id}`];

            nextComponentName = `const joinNext${nextId} = `;

            nextId = "join";

            if (pinValueProxy.frameId === this.scene.id) {
              // 说明是场景输入
              nextValue = `${nextValue}, global.canvas.${this.scene.id}.${pinValueProxy.pinId}`;
            } else {
              // 说明是作用域输入
              if (type === "fx" || type === "globalFx") {
                const inputIndex = inputs!.findIndex(
                  ({ pinId }) => pinId === pinValueProxy.pinId,
                );
                nextValue = `${nextValue}, value${inputIndex}`;
              } else {
                nextValue = `${nextValue}, slot.${pinValueProxy.pinId}`;
              }
            }
          } else {
            if (nextCode.length) {
              destructuringAssignment = `const {${nextCode.join(", ")}} = `;
            }
          }

          if (!isJsFx && !isJsFrameInputComponent && node.to.id && !nextInput) {
            nextInput = ".input";
          }

          if (!isJsScenes) {
            nodesInvocation.add(
              notes +
                "\n" +
                `${destructuringAssignment}${nextComponentName}${nextId}${nextInput}(${nextValue})`,
            );
          }
        } else {
          if (node.to.type === "ext") {
            const pinProxy =
              this.scene.pinProxies[`${node.to.parent.id}-${node.to.id}`];

            if (pinProxy) {
              // 临时兼容插槽的扩展输入和内置显示隐藏，type都是ext，需要引擎做区分
              nodesInvocation.add(
                notes +
                  "\n" +
                  `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}${componentName}_${toComInfo.id}_ref.current.slots.${pinProxy.frameId}.${node.to.id}(${value})`,
              );
            }
          }

          nodesInvocation.add(
            notes +
              "\n" +
              `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}${componentName}_${toComInfo.id}_ref.current.inputs.${node.to.id}(${value})`,
          );
        }

        if (nextSteps.length) {
          nextStep = nextSteps[nextSteps.length - 1];
        } else {
          nextStep--;
        }

        Object.entries(nextMap).forEach(
          ([outputId, { conAry, from }], index) => {
            let value = "";

            if (isJsFx) {
              value = `fx_${toComInfo.id}_${index}`;
            } else if (isJsVar) {
              value = `${componentName}_${toComInfo.id}_${from.startPinParentKey}`;
            } else if (isJsScenes) {
              value = `canvas_${toComInfo.id}_${outputId}`;
            } else if (isJsFrameInputComponent) {
              value = `joinNext_${toComInfo.id}`;
            } else if (isJsComponent) {
              value = `${componentName}_${toComInfo.id}_${outputId}`;
            } else {
              value = `${componentName}_${toComInfo.id}_${outputId}_${from.startPinParentKey}`;
            }

            handleNext(conAry, {
              value: value,
              // currentStep: nextStep + index,
              currentNextStep: nextSteps[index],
              start: false,
            });
          },
        );
      });
    };

    if (defaultValue && startNodes.length) {
      const startNotes: string[] = [];
      startNodes.forEach((startNode, index) => {
        const toComInfo = this.scene.coms[startNode.to.parent.id];
        if (startNode.to.parent.type === "frame") {
          // case0 直接调了fx的输出

          if (type === "fx" || type === "globalFx") {
            // fx 作为函数return返回值，不需要这里的注释
            return;
          }

          // case1 场景的输出
          startNotes.push(
            `// ${startNode.from.title}开始 >> [${notesIndex + index}] (${startNode.to.title}) ${this.frame.title}`,
          );
          return;
        }

        // nextStep = index;
        startNotes.push(
          `// ${startNode.from.title}开始 >> [${notesIndex + index}] (${startNode.to.title}) ${toComInfo.title}`,
        );
      });

      nodesInvocation.add(startNotes.join("\n"));
    }

    handleNext(startNodes, {
      value: defaultValue,
      currentNextStep: nextStep,
      // start: true, // [TODO] 顺序待观察
      start: false,
    });

    return { nodesInvocation, nodesDeclaration, nextStep };
  }

  toCode(slot = this.scene.slot) {
    const ui = this.config.ignoreUI
      ? ""
      : this.handleSlot(slot, {
          useVisible: !validateScenePopup(this.scene),
        });
    const js = this.handleFrame();

    return {
      ui,
      js,
    };
  }

  handleSlot(slot: Slot, config: { useVisible: boolean }): string {
    const { comAry, style, layoutTemplate } = slot;
    let nextCode = "";

    if (style.layout === "smart") {
      nextCode = layoutTemplate.reduce((pre, cur) => {
        if ("def" in cur) {
          return pre + this.handleCom(cur);
        }

        const nextStyle = config.useVisible
          ? `style={Object.assign(${JSON.stringify(cur.style)}, visible ? null : {display: "none"})}`
          : `style={${JSON.stringify(cur.style)}}`;

        return (
          pre +
          `<div ${nextStyle}>${this.handleSlot({ layoutTemplate: cur.elements, style: { layout: "smart" }, id: "", comAry: [] }, { useVisible: false })}</div>`
        );
      }, "");
    } else {
      nextCode = comAry.reduce((pre, cur) => {
        return pre + this.handleCom(cur);
      }, "");
    }

    const nextStyle = config.useVisible
      ? `style={Object.assign(${JSON.stringify(style)}, visible ? null : {display: "none"})}`
      : `style={${JSON.stringify(style)}}`;

    return `<div ${nextStyle}>${nextCode}</div>`;
  }

  handleCom(com: Com) {
    const { id, slots, def, name } = com;
    const comInfo = this.scene.coms[id];
    const { model } = comInfo;
    const { outputEvents, data } = model;
    const componentName = validateUiModule(def.namespace)
      ? `Module_${data.definedId}` // 模块特殊命名方式（内置组件）
      : generateComponentNameByDef(def);

    if (validateUiModule(def.namespace)) {
      // this.config.dependencyImport["../module"].add(`Module_${data.definedId}`);
      collectImportDependencies(this.config.dependencyImport, {
        packageName: "../module",
        dependencyName: `Module_${data.definedId}`,
      });
    } else {
      collectImportDependencies(this.config.dependencyImport, {
        packageName:
          this.config.namespaceToMetaDataMap[def.namespace].npmPackageName,
        dependencyName: componentName,
      });
    }

    const eventsCode = Object.entries(outputEvents).reduce(
      (eventsCode, [input, events]) => {
        const event = events.find((event) => event.active);
        if (event && event.type === "defined") {
          const diagram = this.frame.diagrams.find(
            (diagram) => diagram.id === event.options.id,
          );
          if (diagram) {
            return (eventsCode += `${eventsCode ? " " : ""}${input}={${componentName}_${id}_${input}}`);
          }
        }
        return eventsCode;
      },
      "",
    );

    this.config.dependencyImport["react"].add("useRef");

    this.refs.add(`const ${componentName}_${id}_ref = useRef()`);

    const nextData = validateUiModule(def.namespace) // 模块没有data
      ? `data={${comInfo.model.data.configs ? JSON.stringify(comInfo.model.data.configs) : "{}"}}`
      : `data={${JSON.stringify(deepObjectDiff(this.config.namespaceToMetaDataMap[def.namespace]?.defaultData || {}, model.data))}}`;

    if (slots) {
      this.config.dependencyImport["@mybricks/render-react-hoc"].add("Slot");
      return `<${componentName} ref={${componentName}_${id}_ref} id="${id}" name="${name}" ${this.scene.type === "popup" && comInfo.asRoot ? `canvasId="${this.scene.id}"` : ""} style={${JSON.stringify(model.style)}} ${nextData} ${eventsCode}>
       ${Object.entries(slots).reduce((cur, pre) => {
         const [id, slot] = pre;
         if (slot.type === "scope") {
           const code = new Code(
             this.scene,
             this.frame.coms[comInfo.id].frames.find(
               (frame) => frame.id === id,
             )!,
             this.global,
             {
               ...this.config,
               comsAutoRunKey: `${com.id}-${id}`,
             },
           );
           const { ui, js } = code.toCode(slot);

           return (
             cur +
             `<Slot id="${id}">
              {({ slot }) => {
              ${js}
              return ${ui} 
              }}
              </Slot>`
           );
         } else {
           return (
             cur +
             `<Slot id="${id}">
            {() => {
            return ${this.handleSlot(slot, { useVisible: false })}
            }}
          </Slot>`
           );
         }
       }, "")}
      </${componentName}>
      `;
    } else {
      return `<${componentName} ref={${componentName}_${id}_ref} id="${id}" name="${name}" ${validateUiModule(def.namespace) ? "global={global}" : ""} ${this.scene.type === "popup" && comInfo.asRoot ? `canvasId="${this.scene.id}"` : ""} style={${JSON.stringify(model.style)}} ${nextData} ${eventsCode}/>`;
    }
  }
}

export { toCode };

/** 判断是模块ui组件 */
const validateUiModule = (namespace: string) => {
  return namespace === "mybricks.core-comlib.module";
};

/** 判断是弹窗类场景 */
const validateScenePopup = (scene: Scene) => {
  return scene.type === "popup" || scene.type === "module";
};

/** 判断是输入值获取组件 */
const validateJsFrameInputComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.frame-input";
};

/** 判断是场景类型组件 */
const validateJsScenesComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.scenes";
};

/** 判断是否fx卡片类型组件 */
const validateJsVarComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.var";
};

/** 判断是否fx卡片类型组件 */
const validateJsFxComponent = (namespace: string) => {
  return namespace === "mybricks.core-comlib.fn";
};

/** 判断是否js类型组件 */
const validateJsComponent = (type?: string) => {
  if (!type) {
    return false;
  }

  return type.match(/^js/);
};

/** 判断是否js多输入 */
const validateJsMultipleInputs = (input: string) => {
  return input.match(/\./); // input.xxx 为多输入模式
};

/** 首字母转换为大写 */
const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/** 特殊字符转下划线 */
const convertToUnderscore = (str: string) => {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
};

/** 根据namespace生成组件名 */
const generateComponentNameByDef = ({ namespace, rtType }: Def) => {
  const lastIndex = namespace.lastIndexOf(".");
  return convertToUnderscore(
    lastIndex !== -1 ? namespace.substring(lastIndex + 1) : namespace,
  )
    .split("_")
    .filter((str) => str)
    .reduce((p, c, index) => {
      return (
        p +
        (rtType?.match(/^js/)
          ? index
            ? capitalizeFirstLetter(c)
            : c
          : capitalizeFirstLetter(c))
      );
    }, "");
};

/** 收集依赖 */
const collectImportDependencies = (
  res: Record<string, Set<string>>,
  packageInfo: {
    packageName: string;
    dependencyName: string;
  },
) => {
  const { packageName, dependencyName } = packageInfo;
  if (!res[packageName]) {
    res[packageName] = new Set();
  }

  res[packageName].add(dependencyName);
};

// /** 依赖的组件 */
// const collectComponentDependencies = (
//   deps: Def[],
//   res: Record<string, Set<string>>,
//   config: {
//     namespaceToMetaDataMap: Config["namespaceToMetaDataMap"];
//   },
// ) => {
//   const { namespaceToMetaDataMap } = config;
//   deps.forEach((def) => {
//     if (
//       [
//         "mybricks.core-comlib.fn", // fx、全局fx
//         "mybricks.core-comlib.var", // 变量、全局变量
//         "mybricks.core-comlib.scenes", // 场景
//         "mybricks.core-comlib.frame-input", // 获取各卡片的输入
//         "mybricks.core-comlib.module", // 模块
//       ].includes(def.namespace)
//     ) {
//       // 内置组件，需要过滤
//       return;
//     }
//     const npmPackageName = namespaceToMetaDataMap[def.namespace].npmPackageName;

//     if (!res[npmPackageName]) {
//       res[npmPackageName] = new Set();
//     }

//     res[npmPackageName].add(generateComponentNameByDef(def));
//   });
// };

/** 生成导入组件依赖代码 */
const generateImportDependenciesCode = (res: Record<string, Set<string>>) => {
  let code = "";
  const reactDependencies = res["react"];
  if (reactDependencies) {
    if (reactDependencies.size) {
      code = `import React, { ${Array.from(res["react"]).join(", ")} } from "react";`;
    } else {
      code = 'import React from "react";';
    }
    Reflect.deleteProperty(res, "react");
  }
  return Object.entries(res).reduce((pre, cur) => {
    const [npmPackageName, dependency] = cur;
    if (dependency.size) {
      return (
        pre +
        `import { ${Array.from(dependency).join(", ")} } from "${npmPackageName}";`
      );
    }
    return pre;
  }, code);
};
