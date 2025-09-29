import { indentation } from "../string";
import type { FrameIO } from "../../../toCode/types";
import { genObjectCode } from ".";

interface Params {
  type: string;
  appContext: string;
  inputs: FrameIO[];
  outputs: FrameIO[];
  pageId?: string;
}
interface Config {
  initialIndent: number;
  indentSize: number;
}
const genMyBricksDescriptorCode = (params: Params, config: Config) => {
  const { type, pageId, appContext, inputs, outputs } = params;
  const { initialIndent, indentSize } = config;

  const inputNameMap = inputs?.length
    ? inputs.reduce<Record<string, string>>((pre, cur) => {
        pre[cur.title] = cur.id;
        return pre;
      }, {})
    : null;

  const outputNameMap = outputs?.length
    ? outputs.reduce<Record<string, string>>((pre, cur) => {
        pre[cur.title] = cur.id;
        return pre;
      }, {})
    : null;

  const indent = indentation(initialIndent);
  const indent2 = indentation(initialIndent + indentSize);
  return (
    `${indent}@MyBricksDescriptor({` +
    `\n${indent2}type: "${type}",` +
    (pageId ? `\n${indent2}pageId: "${pageId}",` : "") +
    `\n${indent2}${appContext},` +
    (inputNameMap
      ? `\n${indent2}inputNameMap: ${genObjectCode(inputNameMap, {
          indentSize,
          initialIndent: initialIndent + indentSize,
        })},`
      : "") +
    (outputNameMap
      ? `\n${indent2}outputNameMap: ${genObjectCode(outputNameMap, {
          indentSize,
          initialIndent: initialIndent + indentSize,
        })},`
      : "") +
    `\n${indent}})`
  );
};

export { genMyBricksDescriptorCode };
