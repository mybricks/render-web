import * as CSS from "csstype";

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
}

interface Scene {
  id: string;
  title: string;
  slot: Slot;
  coms: Record<string, ComInfo>;
  pinRels: Record<string, string[]>;
  deps: Def[];
  comsAutoRun: Record<string, { id: string }[]>;
  type: "normal" | "popup";
  pinProxies: Record<
    string,
    {
      frameId: string;
      pinId: string;
    }
  >;
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
  type: "fx" | "com";
}

interface ToJSON {
  frames: Frame[];
  scenes: Scene[];
}

interface Config {
  /** 组件namespace到npm包的映射 */
  namespaceToNpmMap: Record<string, string>;
}

const toCode = (tojson: ToJSON, config: Config) => {
  const { frames, scenes } = tojson;
  const { namespaceToNpmMap } = config;

  let canvasDeclaration = "";
  let canvasRender = "";
  let canvasState = "";

  const dependencyImport: Record<string, Set<string>> = {};

  scenes.forEach((scene, index) => {
    // 找到对应的scene对应的frame
    const frame = frames.find((frame) => frame.id === scene.id);
    const code = new Code(scene, frame!, {
      comsAutoRunKey: "_rootFrame_",
    });
    const { ui, js } = code.toCode();

    scene.deps.forEach((def) => {
      if (
        [
          "mybricks.core-comlib.fn",
          "mybricks.core-comlib.var",
          "mybricks.core-comlib.scenes",
        ].includes(def.namespace)
      ) {
        // 内置组件，需要过滤
        return;
      }
      const npm = namespaceToNpmMap[def.namespace];

      if (!dependencyImport[npm]) {
        dependencyImport[npm] = new Set();
      }

      dependencyImport[npm].add(generateComponentNameByDef(def));
    });

    canvasDeclaration += `// ${scene.title}
    const Canvas_${scene.id} = ({ visible, global }) => {
      ${js}

      return ${ui}
    }
    \n`;

    canvasRender += `{canvasState.${scene.id}.mounted && (
      <Canvas_${scene.id} visible={canvasState.${scene.id}.visible} global={global}/>
    )}`;

    canvasState += `${scene.id}: {
      mounted: ${index === 0 ? "true" : "false"},
      visible: ${index === 0 ? "true" : "false"},
      type: "${scene.type}",
    },`;
  });

  const dependencyImportCode = Object.entries(dependencyImport).reduce(
    (pre, cur) => {
      const [npm, dependency] = cur;
      return (
        pre + `import { ${Array.from(dependency).join(", ")} } from "${npm}";`
      );
    },
    "",
  );

  canvasState = `const [canvasState, canvasIO] = useCanvasState({
    ${canvasState}
  })`;

  return `import React, { useRef, useMemo, useEffect } from "react"
      ${dependencyImportCode}
      import { Provider, Slot, merge, inputs, useVar, useCanvasState } from "@mybricks/render-react-hoc";

      export default function () {
        ${canvasState}

        const global = useMemo(() => {
          return {
            var: {}, // [TODO] 全局变量
            fx: {}, // [TODO] 全局FX
            canvas: canvasIO
          }
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

      ${canvasDeclaration}
      `;
};

class Code {
  // ref声明
  refs: Set<string> = new Set();

  // 变量声明
  vars: Set<string> = new Set();

  constructor(
    private scene: Scene,
    private frame: Frame,
    private config: {
      comsAutoRunKey: string;
    },
  ) {}

  handleFrame() {
    // console.log("toCode scene 🍎 => ", this.scene);
    // console.log(1, "frame 🍎🍎🍎 => ", this.frame);

    const nextCode: string[] = [];

    this.frame.diagrams.forEach((diagram) => {
      nextCode.push(this.handleDiagram(diagram, {}));
    });
    this.frame.frames.forEach(({ diagrams, type }) => {
      nextCode.push(this.handleDiagram(diagrams[0], { type }));
    });

    return (
      Array.from(this.refs).join("\n") +
      (this.refs.size > 1 ? "\n\n" : "\n") +
      Array.from(this.vars).join("\n") +
      nextCode.filter((c) => c).join("\n\n")
    );
  }

  handleDiagram(diagram: Diagram, { type }: { type?: string }) {
    const { starter, conAry } = diagram;

    if (
      diagram.starter.type === "frame" &&
      diagram.starter.frameId === this.scene.id
    ) {
      // useEffect 卡片 main
      // 一定只有一个输入，后续有多个输入的话再看下
      const startNodes = conAry.filter(
        (con) => con.from.parent.id === starter.frameId,
      );

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

      const res = this.handleDiagramNext({
        startNodes,
        diagram,
        defaultValue: `global.canvas.${this.scene.id}.inputs.open`,
        nextStep: startNodes.length - 1,
        nodesDeclaration,
        nodesInvocation,
        multipleInputsNodes,
        notesIndex: 0,
        frameOutputs: {},
        type,
      });

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
        }, res.nextStep);
      }

      return startNodes.length || comsAutoRun
        ? `useEffect(() => {
      ${nodesDeclaration.size ? "// 节点声明" : ""}
      ${Array.from(nodesDeclaration).join("\n")}

      ${Array.from(nodesInvocation).join("\n\n")}
      }, [])`
        : "";
    } else if (diagram.starter.type === "frame" && type === "fx") {
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
          type,
        });

        return res.nextStep + startNodes.length;
      }, 0);

      const frame = this.frame.frames.find((frame) => {
        return frame.id === starter.frameId;
      });

      return `// ${frame!.title}
      const fx_${starter.frameId} = (${starter.pinAry.map((_, index) => `value${index}`).join(", ")}) => {
      ${nodesDeclaration.size ? "// 节点声明" : ""}
      ${Array.from(nodesDeclaration).join("\n")}

      ${Array.from(nodesInvocation).join("\n\n")}

      ${
        frame!.outputs.length
          ? `return [${frame!.outputs.reduce((pre, { id, title }) => {
              const outputs = frameOutputs[id];

              if (outputs.size) {
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
      const componentName = generateComponentNameByDef(toComInfo.def);

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
        this.vars.add(`// ${diagram.title}
        const var_${toComInfo.id} = useVar(${"initValue" in toComInfo.model.data ? JSON.stringify(toComInfo.model.data.initValue) : "undefined"}, (value) => {
        ${nodesDeclaration.size ? "// 节点声明" : ""}
        ${Array.from(nodesDeclaration).join("\n")}
  
        ${Array.from(nodesInvocation).join("\n\n")}
        });
        `);

        return "";
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
          if (type === "fx") {
            // 这里说明是卡片的输出，不需要再往下走了
            if (!frameOutputs[node.to.id]) {
              frameOutputs[node.to.id] = new Set();
            }
            frameOutputs[node.to.id].add(value);
          } else {
            nodesInvocation.add(
              `// [${start ? nodeIndex : nextStep}] -> (${node.to.title}) ${this.scene.title}
              global.canvas.${this.frame.id}.outputs.${node.to.id}(${value});`,
            );
          }
          return;
        }

        const toComInfo = this.scene.coms[node.to.parent.id];
        const componentName = generateComponentNameByDef(toComInfo.def);

        const isJsComponent = validateJsComponent(toComInfo.def.rtType);
        const isJsFx = validateJsFxComponent(toComInfo.def.namespace);
        const isJsVar = validateJsVarComponent(toComInfo.def.namespace);
        const isJsScenes = validateJsScenesComponent(toComInfo.def.namespace);

        if (isJsComponent && !isJsFx && !isJsVar && !isJsScenes) {
          // fx 变量不需要声明节点
          nodesDeclaration.add(
            `const ${componentName}_${toComInfo.id} = ${componentName}({data: ${JSON.stringify(toComInfo.model.data)}, inputs: ${JSON.stringify(toComInfo.inputs)}, outputs: ${JSON.stringify(toComInfo.outputs)}})`,
          );
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

          Object.entries(nextMap).forEach(([, { from, conAry }]) => {
            notes += `\n// ${from.from.title} >> ${conAry
              .map((con, index) => {
                if (con.to.parent.type === "frame") {
                  return `(${con.to.title}) ${diagram.title}`;
                }
                const toComInfo = this.scene.coms[con.to.parent.id];
                nextSteps.push(nextStep + index);
                return `[${nextStep + index}] (${con.to.title}) ${toComInfo.title}`;
              })
              .join(", ")}`;
          });
        }

        if (isJsComponent) {
          let nextInput = "";
          let nextValue = value;
          let nextId = toComInfo.id;
          let nextComponentName = componentName;
          let destructuringAssignment = "";

          if (isJsScenes) {
            nodesInvocation.add(
              notes +
                "\n" +
                `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}global.canvas.${toComInfo.model.data._sceneId}.inputs.${toComInfo.model.data._pinId}(${value});`,
            );
          } else if (isJsFx) {
            const frame = this.frame.frames.find((frame) => {
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
            nextId = toComInfo.ioProxy.id;
            nextComponentName = "fx";
            if (nextCode.length) {
              destructuringAssignment = `const [${nextCode.map((_, index) => `${nextComponentName}_${toComInfo.id}_${index}`).join(", ")}] = `;
            }
          } else if (isJsVar) {
            nextInput = `.${node.to.id}`;
            if (nextCode.length) {
              destructuringAssignment = `const ${nextCode[0]} = `;
            }
          } else if (isJsMultipleInputs) {
            nextValue = multipleInputsNodes[toComInfo.id].value.join(", ");
            if (nextCode.length) {
              destructuringAssignment = `const {${nextCode.join(", ")}} = `;
            }
          } else {
            if (nextCode.length) {
              destructuringAssignment = `const {${nextCode.join(", ")}} = `;
            }
          }

          if (!isJsFx && node.to.id && !nextInput) {
            nextInput = ".input";
          }

          if (!isJsScenes) {
            nodesInvocation.add(
              notes +
                "\n" +
                `${destructuringAssignment}${nextComponentName}_${nextId}${nextInput}(${nextValue})`,
            );
          }
        } else {
          if (node.to.type === "ext") {
            const pinProxy =
              this.scene.pinProxies[`${node.to.parent.id}-${node.to.id}`];

            nodesInvocation.add(
              notes +
                "\n" +
                `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}${componentName}_${toComInfo.id}_ref.current.slots.${pinProxy.frameId}.${node.to.id}(${value})`,
            );
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

          if (type === "fx") {
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
      start: true,
    });

    return { nodesInvocation, nodesDeclaration, nextStep };
  }

  toCode(slot = this.scene.slot) {
    const ui = this.handleSlot(slot);
    const js = this.handleFrame();

    return {
      ui,
      js,
    };
  }

  handleSlot(slot: Slot): string {
    const { comAry, style, layoutTemplate } = slot;
    let nextCode = "";

    if (style.layout === "smart") {
      nextCode = layoutTemplate.reduce((pre, cur) => {
        if ("def" in cur) {
          return pre + this.handleCom(cur);
        }

        return (
          pre +
          `<div style={${JSON.stringify(cur.style)}}>${this.handleSlot({ layoutTemplate: cur.elements, style: { layout: "smart" }, id: "", comAry: [] })}</div>`
        );
      }, "");
    } else {
      nextCode = comAry.reduce((pre, cur) => {
        return pre + this.handleCom(cur);
      }, "");
    }
    return `<div style={${JSON.stringify(style)}}>${nextCode}</div>`;
  }

  handleCom(com: Com) {
    const { id, slots, def, name } = com;
    const componentName = generateComponentNameByDef(def);
    const comInfo = this.scene.coms[id];
    const { model } = comInfo;
    const { outputEvents } = model;

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

    this.refs.add(`const ${componentName}_${id}_ref = useRef()`);

    if (slots) {
      return `<${componentName} ref={${componentName}_${id}_ref} id="${id}" name="${name}" ${this.scene.type === "popup" && comInfo.asRoot ? `canvasId="${this.scene.id}"` : ""} style={${JSON.stringify(model.style)}} data={${JSON.stringify(model.data)}} ${eventsCode}>
       ${Object.entries(slots).reduce((cur, pre) => {
         const [id, slot] = pre;
         if (slot.type === "scope") {
           const code = new Code(
             this.scene,
             this.frame.coms[comInfo.id].frames.find(
               (frame) => frame.id === id,
             )!,
             {
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
            return ${this.handleSlot(slot)}
            }}
          </Slot>`
           );
         }
       }, "")}
      </${componentName}>
      `;
    } else {
      return `<${componentName} ref={${componentName}_${id}_ref} id="${id}" name="${name}" ${this.scene.type === "popup" && comInfo.asRoot ? `canvasId="${this.scene.id}"` : ""} style={${JSON.stringify(model.style)}} data={${JSON.stringify(model.data)}} ${eventsCode}/>`;
    }
  }
}

export { toCode };

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
