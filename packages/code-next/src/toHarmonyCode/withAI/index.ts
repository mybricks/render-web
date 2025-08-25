import toCode from "../../toCode";
import type { ToJSON } from "../../toCode/types";
import renameFileName from "./renameFileName";
import renameComponentName from "./renameComponentName";

export interface AIConfig {
  // model: string;
  // url: string;
  transform: (
    messages: {
      role: string;
      content: string;
    }[],
  ) => Promise<string>;
}

export interface AIParams {
  tojson: ToJSON;
  toCodejson: ReturnType<typeof toCode>;
}
const ai = async (params: AIParams, config: AIConfig) => {
  // 这里搜集需要转换的东西
  const [fileNames, componentNames] = await Promise.all([
    renameFileName(params.tojson, config),
    renameComponentName(params, config),
  ]);

  return {
    fileNames,
    componentNames,
  };
};

export default ai;
