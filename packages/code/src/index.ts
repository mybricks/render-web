import type { ToJSON } from "@mybricks/render-types";

/** 
 * TODO: 通用MyBricks引擎toJSON产物解析器，之后在出Vue产物的时候结合来看
 */
export async function protocolParser(toJSON: ToJSON) {
  return toJSON
}

export { generateToReactCode } from "./react";
