import { ToJSON } from "../../../toCode/types";
import { AIConfig } from "..";
// import fetchAI from "../fetchAI";

const system = `你是一名前端开发专家，负责根据页面标题生成符合规范的文件名。请遵循以下规则：

1. 使用大驼峰命名法（PascalCase）。
2. fileName 只能包含大小写字母和数字（匹配正则 \`/^[a-zA-Z0-9]+$/\`），不得包含空格、符号或中文字符。
3. 根据中文标题的语义，翻译为简洁、语义清晰明确的英文单词或短语。
4. 只补全 \`fileName\` 字段，不得修改 JSON 结构、添加注释或解释。
5. \`fileName\` 不允许重复。

输入是一个 JSON 数组，每个对象包含字段：
- id：页面唯一标识（保持不变）
- title：页面中文标题
- fileName：初始为 null，需要你补全

输出必须是与输入结构完全一致的 JSON 数组。

示例：
输入：
\`\`\`json
[
  { "id": "u_demo1", "title": "首页", "fileName": null },
  { "id": "u_demo2", "title": "商品详情页", "fileName": null }
]
\`\`\`

输出：
\`\`\`json
[
  { "id": "u_demo1", "title": "首页", "fileName": "Home" },
  { "id": "u_demo2", "title": "商品详情页", "fileName": "ProductDetails" }
]
\`\`\``;

const renameFileName = async (tojson: ToJSON, config: AIConfig) => {
  // [TODO] 错误处理，重试
  const fileNames = tojson.scenes.map((scene) => {
    return {
      id: scene.id,
      title: scene.title,
      fileName: null,
    };
  });

  const response = await config.transform([
    {
      role: "system",
      content: system,
    },
    {
      role: "user",
      content: "```json\n" + `${JSON.stringify(fileNames)}\n` + "```",
    },
  ]);

  // const response = await fetchAI({
  //   body: {
  //     messages: [
  //       {
  //         role: "system",
  //         content: system,
  //       },
  //       {
  //         role: "user",
  //         content: "```json\n" + `${JSON.stringify(fileNames)}\n` + "```",
  //       },
  //     ],
  //     model: config.model,
  //   },
  //   url: config.url,
  // });

  const resultFileNames = JSON.parse(
    response.match(/```json\s*([\s\S]*?)\s*```/)![1],
  );

  return resultFileNames;
};

export default renameFileName;
