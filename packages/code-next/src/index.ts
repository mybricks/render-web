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
}

interface ComInfo {
  id: string;
  title: string;
  def: Def;
  model: {
    data: [];
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
}

interface Scene {
  id: string;
  slot: Slot;
  coms: Record<string, ComInfo>;
  pinRels: Record<string, string[]>;
  deps: Def[];
  comsAutoRun: Record<string, { id: string }[]>;
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
    };
  };
  finishPinParentKey?: string;
  startPinParentKey?: string;
}

interface Diagram {
  id: string;
  starter: {
    comId: string;
    frameId: string;
    pinId: string;
    pinAry: {
      id: string;
    }[];
    type: "com" | "frame";
  };
  conAry: DiagramCon[];
}

interface Frame {
  id: string;
  diagrams: Diagram[];
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

  let res = "";

  scenes.forEach((scene) => {
    // 找到对应的scene对应的frame
    const frame = frames.find((frame) => frame.id === scene.id);
    const code = new Code(scene, frame!);
    const { ui, js } = code.toCode();
    const dependencyImport: Record<string, Set<string>> = {};

    scene.deps.forEach((def) => {
      const npm = namespaceToNpmMap[def.namespace];

      if (!dependencyImport[npm]) {
        dependencyImport[npm] = new Set();
      }

      dependencyImport[npm].add(generateComponentNameByDef(def));
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

    res = `
      import React, { useRef, useEffect } from "react"
      ${dependencyImportCode}
      import { Provider } from "@mybricks/render-react-hoc";

      export default function () {
        ${js}

        return (
          <Provider
            env={{
              runtime: true,
              i18n: (value) => value
            }}
          >
            ${ui}
          </Provider>
        )
      }
    `;
  });

  return res;
};

class Code {
  // 事件 ui处理过程中判断是否有事件
  events: Record<string, string> = {};

  // ref声明
  refs: Set<string> = new Set();

  constructor(
    private scene: Scene,
    private frame: Frame,
  ) {}

  handleFrame() {
    // console.log("toCode scene 🍎 => ", this.scene);
    // console.log(1, "frame 🍎 => ", this.frame);
    // console.log("toCode events 🍌 => ", this.events);

    const nextCode: string[] = [];

    // Object.entries(this.events).forEach(([, diagramId]) => {
    //   const diagram = this.frame.diagrams.find(
    //     (diagram) => diagram.id === diagramId,
    //   )!;

    //   nextCode.push(this.handleDiagram(diagram));
    // });

    this.frame.diagrams.forEach((diagram) => {
      nextCode.push(this.handleDiagram(diagram));
    });

    return (
      Array.from(this.refs).join("\n") +
      (this.refs.size > 1 ? "\n\n" : "\n") +
      nextCode.join("\n\n")
    );
  }

  handleDiagram(diagram: Diagram) {
    // console.log(1, "当前 处理 diagram => ", diagram);
    const { starter, conAry } = diagram;

    if (
      diagram.starter.type === "frame" &&
      diagram.starter.frameId === this.scene.id
    ) {
      // useEffect 卡片 main
      // [TODO]: 先默认只有一个输入，下一步fx考虑多输入了
      const startNodes = conAry.filter(
        (con) => con.from.id === starter.pinAry[0].id,
      );

      // main卡片默认是_rootFrame_
      const comsAutoRun = this.scene.comsAutoRun["_rootFrame_"];

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
        defaultValue: "undefined",
        nextStep: startNodes.length - 1,
        nodesDeclaration,
        nodesInvocation,
        multipleInputsNodes,
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
          });

          return res.nextStep;
        }, res.nextStep);
      }

      return `useEffect(() => {
      ${nodesDeclaration.size ? "// 节点声明" : ""}
      ${Array.from(nodesDeclaration).join("\n")}

      ${Array.from(nodesInvocation).join("\n\n")}
      }, [])`;
    } else {
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
        nextStep: startNodes.length - 1,
        nodesDeclaration,
        nodesInvocation,
        multipleInputsNodes,
      });

      // const { nodesInvocation, nodesDeclaration } = this.handleDiagramNext({
      //   startNodes,
      //   diagram,
      //   defaultValue: "value",
      // });

      return `const ${componentName}_${starter.comId}_${starter.pinId} = (value) => {
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
  }) {
    const { conAry } = diagram;

    const handleNext = (
      nodes: DiagramCon[],
      { value, currentNextStep }: { value: string; currentNextStep: number },
    ) => {
      nodes.forEach((node, nodeIndex) => {
        const toComInfo = this.scene.coms[node.to.parent.id];
        const componentName = generateComponentNameByDef(toComInfo.def);

        const isJsComponent = validateJsComponent(toComInfo.def.rtType);

        if (isJsComponent) {
          nodesDeclaration.add(
            `const ${componentName}_${toComInfo.id} = ${componentName}({data: ${JSON.stringify(toComInfo.model.data)}, inputs: ${JSON.stringify(toComInfo.inputs)}, outputs: ${JSON.stringify(toComInfo.outputs)}})`,
          );
        }

        nextStep++;

        const isJsMultipleInputs = toComInfo.inputs[0] // 没有输入默认判定为启始组件
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
            (isJsComponent // 如果是ui组件，单实例，根据finishPinParentKey和startPinParentKey来进行连接
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
            nextCode.push(
              `${outputId}: ${componentName}_${toComInfo.id}_${outputId}`,
            );
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
                const toComInfo = this.scene.coms[con.to.parent.id];
                nextSteps.push(nextStep + index);
                return `[${nextStep + index}] (${con.to.title}) ${toComInfo.title}`;
              })
              .join(", ")}`;
          });
        } else {
          notes = `// [${currentNextStep + nodeIndex}] -> (${node.to.title}) ${toComInfo.title}`;

          Object.entries(nextMap).forEach(([, { from, conAry }]) => {
            notes += `\n// ${from.from.title} >> ${conAry
              .map((con, index) => {
                const toComInfo = this.scene.coms[con.to.parent.id];
                nextSteps.push(nextStep + index);
                return `[${nextStep + index}] (${con.to.title}) ${toComInfo.title}`;
              })
              .join(", ")}`;
          });
        }

        if (isJsComponent) {
          nodesInvocation.add(
            notes +
              "\n" +
              `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}${componentName}_${toComInfo.id}${node.to.id ? `.input` : ""}(${isJsMultipleInputs ? `${multipleInputsNodes[toComInfo.id].value.join(", ")}` : value})`,
          );
        } else {
          nodesInvocation.add(
            notes +
              "\n" +
              `${nextCode.length ? `const {${nextCode.join(", ")}} = ` : ""}${componentName}_${toComInfo.id}_ref.current.${node.to.id}(${value})`,
          );
        }

        if (nextSteps.length) {
          nextStep = nextSteps[nextSteps.length - 1];
        } else {
          nextStep--;
        }

        Object.entries(nextMap).forEach(
          ([outputId, { conAry, from }], index) => {
            handleNext(conAry, {
              value: isJsComponent
                ? `${componentName}_${toComInfo.id}_${outputId}`
                : `${componentName}_${toComInfo.id}_${outputId}_${from.startPinParentKey}`,
              // currentStep: nextStep + index,
              currentNextStep: nextSteps[index],
            });
          },
        );
      });
    };

    if (defaultValue) {
      const startNotes: string[] = [];
      startNodes.forEach((startNode, index) => {
        const toComInfo = this.scene.coms[startNode.to.parent.id];
        // nextStep = index;
        startNotes.push(
          `// ${startNode.from.title}开始 >> [${index}] (${startNode.to.title}) ${toComInfo.title}`,
        );
      });

      nodesInvocation.add(startNotes.join("\n"));
    }

    handleNext(startNodes, {
      value: defaultValue,
      currentNextStep: nextStep,
    });

    return { nodesInvocation, nodesDeclaration, nextStep };
  }

  toCode() {
    const ui = this.handleSlot(this.scene.slot);
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
    const { id, slots, def } = com;
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
            // 事件存储
            this.events[`${componentName}_${id}_${input}`] = diagram.id;
            return (eventsCode += `${eventsCode ? " " : ""}${input}={${componentName}_${id}_${input}}`);
          }
        }
        return eventsCode;
      },
      "",
    );

    this.refs.add(`const ${componentName}_${id}_ref = useRef()`);

    if (slots) {
      return `<${componentName} ref={${componentName}_${id}_ref} style={${JSON.stringify(model.style)}} data={${JSON.stringify(model.data)}} ${eventsCode}>
        {{${Object.entries(slots).reduce((cur, pre) => {
          const [id, slot] = pre;
          return (
            cur +
            `${id}() {
            return ${this.handleSlot(slot)}
          }` +
            ","
          );
        }, "")}}}
      </${componentName}>
      `;
    } else {
      return `<${componentName} ref={${componentName}_${id}_ref} style={${JSON.stringify(model.style)}} data={${JSON.stringify(model.data)}} ${eventsCode}/>`;
    }
  }
}

export { toCode };

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
