/* eslint-disable @typescript-eslint/no-explicit-any */
import { ToJSON } from "src/toCode/types";
import { AIConfig, AIParams } from "..";
// import fetchAI from "../fetchAI";

const systemUI = `你是一名前端开发专家，负责根据组件的标题编写符合规范的组件名。请遵循以下规则：

1. 使用小驼峰命名法（lower camel case）。
2. \`componentName\` 只能包含大小写字母和数字（匹配正则 \`/^[a-zA-Z0-9]+$/\`），不得包含空格、符号或中文字符。
3. 根据中文标题的语义，翻译为简洁、语义清晰明确的英文单词或短语。
4. 只补全 \`componentName\` 字段，不得修改 JSON 结构、添加注释或解释。
5. \`componentName\` 不允许重复。

输入是一个 JSON 数组，每个对象包含字段：
- id：组件唯一标识（保持不变）
- title：组件中文标题
- componentName：初始为 null，需要你补全

输出必须是与输入结构完全一致的 JSON 数组。

示例：
输入：
\`\`\`json
[
  { "id": "u_demo1", "title": "按钮", "componentName": null },
  { "id": "u_demo2", "title": "图片", "componentName": null }
]
\`\`\`

输出：
\`\`\`json
[
  { "id": "u_demo1", "title": "按钮", "componentName": "button" },
  { "id": "u_demo2", "title": "图片", "componentName": "image" }
]
\`\`\``;

// const systemEvent = `你是一名前端开发专家，负责根据事件内 \`函数声明标题\` 和 \`函数调用标题\` 编写符合规范的函数变量名和函数调用返回值变量名。请遵循以下规则：

// 1. 使用小驼峰命名法（lower camel case）。
// 2. \`variableName\` 只能包含大小写字母和数字（匹配正则 \`/^[a-zA-Z0-9]+$/\`），不得包含空格、符号或中文字符。
// 3. 根据中文标题的语义，翻译为简洁、语义清晰明确的英文单词或短语。
// 4. 只补全 \`variableName\` 字段，不得修改 JSON 结构、添加注释或解释。
// 5. \`nodes\` 数组内的 \`variableName\` 不允许重复。

// 输入是一个 JSON 数组，每个对象包含字段：
// - id：事件唯一标识（保持不变）
// - nodes：事件内各函数声明和调用顺序
//   - id：函数唯一标识（保持不变）
//   - title：函数声明和调用的中文标题
//   - type：\`declaration\` （函数声明），\`call\` （函数调用）
//   - variableName：初始为 null，需要你不全

// 输出必须是与输入结构完全一致的 JSON 数组。

// 注意：
// 1. nodes的顺序是事件内函数声明和调用的正确执行顺序。
// 2. 仔细分析执行顺序和各节点标题，如果节点标题重复，应该结合上下文节点进行分析，例如都调用相同组件的方法fn后的返回值，可以分析上一个节点是什么，相结合来编写一个合适的名字。

// 示例：
// 输入：
// \`\`\`json
// [
//   {
//     "id": "u_demo1",
//     "nodes": [
//       {
//         "id": "u_node1",
//         "title": "显示 Toast",
//         "type": "declaration",
//         "variableName": null
//       },
//       {
//         "id": "u_node1",
//         "title": "显示 Toast",
//         "type": "call",
//         "variableName": null
//       }
//     ]
//   },
// ]
// \`\`\`

// 输出：
// \`\`\`json
// [
//   {
//     "id": "u_demo1",
//     "nodes": [
//       {
//         "id": "u_node1",
//         "title": "显示 Toast",
//         "type": "declaration",
//         "variableName": "showToast"
//       },
//       {
//         "id": "u_node1",
//         "title": "显示 Toast",
//         "type": "call",
//         "variableName": "showToastResult"
//       }
//     ]
//   },
// ]
// \`\`\``;

const systemEvent = `你是一名资深前端架构师，负责为事件流中的「函数声明」与「函数调用」节点生成**语义准确、不重复、符合规范**的变量名。

## 输入说明
- 一个 JSON 数组，每个对象代表一个事件。
- 每个事件对象包含：
  - \`id\`：事件ID
  - \`functionDefinition\`：函数声明数组，顺序排列
    - \`id\`：节点ID
    - \`comments\`：节点注释
    - \`variableName\`: 初始为 \`null\`，需要由你补全。
  - \`functionExecution\`：函数调用数组，顺序排列
    - \`id\`：节点ID
    - \`comments\`：节点注释
    - \`connectId\`：用于区分相同函数调用的不同输出分支。
    - \`variableName\`: 初始为 \`null\`，需要由你补全。

## 输出要求
1. **仅补全 \`variableName\` 字段**，不得新增、删除、修改任何其他字段，不得出现注释或解释。
2. 使用 **lowerCamelCase** 小驼峰命名法，仅含大小写字母与数字（\`/^[a-zA-Z0-9]+$/\`）。
3. 命名必须精准传达中文标题的**业务语义**与**动作阶段**
4. 出现同名冲突时，按以下优先级消歧：
  1. 语义消歧：用更细化的同义词或领域词替换，如 \`toast\`、\`tip\`、\`notify\`。
  2. 场景消歧：追加场景/领域缩写，如 \`showToastOnSubmit\`、\`showToastOnError\`。
  3. 顺序消歧：万不得已再使用数字后缀，且数字从 1 开始，如 \`showToast1\`。

## 
示例：
输入：
\`\`\`json
[
  {
    "id": "u_demo1",
    "functionDefinition": [
      {
        "id": "u_node1",
        "comments": "“显示 Toast”函数定义",
        "variableName": null
      }
    ],
    "functionExecution": [
      {
        "id": "u_node1",
        "comments": "执行函数“显示 Toast.显示”的返回值",
        "variableName": null
      }
    ]
  },
]
\`\`\`

输出：
\`\`\`json
[
  {
    "id": "u_demo1",
    "functionDefinition": [
      {
        "id": "u_node1",
        "comments":  "“显示 Toast”函数定义",
        "variableName": "showToast"
      }
    ],
    "functionExecution": [
      {
        "id": "u_node1",
        "comments": "执行函数“显示 Toast.显示”的返回值",
        "variableName": "showToastResult"
      }
    ]
  },
]
\`\`\``;

const renameComponentName = async (params: AIParams, config: AIConfig) => {
  const { tojson, toCodejson } = params;

  const scenes: {
    ui: Record<
      string,
      {
        id: string;
        title: string;
        /**
         * componentName button
         * controller    this.xxx.buttonController
         * slots         this.buttonSlots
         * ComponentV2   Button{SlotId}
         * class         Button{SlotId}Provider
         */
        componentName: null;
      }[]
    >;
    scene: ToJSON["scenes"][0];
    event: any[];
  }[] = [];

  await Promise.all(
    tojson.scenes.map(async (scene) => {
      // 组件名称
      const ui: (typeof scenes)[0]["ui"] = {};

      Object.entries(scene.coms).forEach(([, com]) => {
        if (com.global) {
          // 不处理全局变量
          return;
        }
        if (com.def.rtType) {
          // 不处理非UI组件
          return;
        }
        const isScope = com.parentComId && com.frameId;
        const componentNamesMapkey = isScope
          ? `${com.parentComId}_${com.frameId}`
          : "root";
        if (!ui[componentNamesMapkey]) {
          ui[componentNamesMapkey] = [];
          if (isScope) {
            const parentCom = scene.coms[com.parentComId!];
            const frame = parentCom.frames!.find(
              (frame) => frame.id === com.frameId,
            )!;
            ui[componentNamesMapkey].push({
              id: parentCom.id,
              title: `${parentCom.title}（${frame.title}）`,
              componentName: null,
            });
          }
        }
        ui[componentNamesMapkey].push({
          id: com.id,
          title: com.title,
          componentName: null,
        });
      });

      // 事件
      let event: {
        id: string;
        functionDefinition: any[];
        functionExecution: any[];
      }[] = [];

      (toCodejson.scenes.find((toCodeScene) => {
        return toCodeScene.ui.meta.slotId === scene.id;
      }) ||
        toCodejson.modules.find((toCodeScene) => {
          return toCodeScene.ui.meta.slotId === scene.id;
        }))!.event.forEach(({ diagramId, process }) => {
        const { nodesDeclaration, nodesInvocation } = process;
        event.push({
          id: diagramId,
          functionDefinition: nodesDeclaration.map(({ meta }: any) => {
            return {
              id: meta.id,
              comments: `"${meta.title}"函数定义`,
              variableName: null,
            };
          }),
          functionExecution: nodesInvocation.map(
            ({ title, meta, nextParam }: any) => {
              return {
                id: meta.id,
                connectId: nextParam?.[0]?.connectId,
                comments: `执行函数"${meta.title}.${title}"的返回值`,
                variableName: null,
              };
            },
          ),
        });
      });

      await Promise.all([
        ...Object.entries(ui).map(async ([key, componentNames]) => {
          const response = await config.transform([
            {
              role: "system",
              content: systemUI,
            },
            {
              role: "user",
              content:
                "```json\n" + `${JSON.stringify(componentNames)}\n` + "```",
            },
          ]);
          // const response = await fetchAI({
          //   body: {
          //     messages: [
          //       {
          //         role: "system",
          //         content: systemUI,
          //       },
          //       {
          //         role: "user",
          //         content:
          //           "```json\n" + `${JSON.stringify(componentNames)}\n` + "```",
          //       },
          //     ],
          //     model: config.model,
          //   },
          //   url: config.url,
          // });

          const resultComponentNames = JSON.parse(
            response.match(/```json\s*([\s\S]*?)\s*```/)![1],
          );

          ui[key] = resultComponentNames;
        }),
        (async () => {
          const response = await config.transform([
            {
              role: "system",
              content: systemEvent,
            },
            {
              role: "user",
              content: "```json\n" + `${JSON.stringify(event)}\n` + "```",
            },
          ]);
          // const response = await fetchAI({
          //   body: {
          //     messages: [
          //       {
          //         role: "system",
          //         content: systemEvent,
          //       },
          //       {
          //         role: "user",
          //         content: "```json\n" + `${JSON.stringify(event)}\n` + "```",
          //       },
          //     ],
          //     model: config.model,
          //   },
          //   url: config.url,
          // });

          const resultComponentNames = JSON.parse(
            response.match(/```json\s*([\s\S]*?)\s*```/)![1],
          );

          event = resultComponentNames;
        })(),
      ]);

      scenes.push({
        ui,
        scene,
        event,
      });
    }),
  );

  return scenes;
};

export default renameComponentName;
