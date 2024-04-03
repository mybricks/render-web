import { ToJSON } from "@mybricks/render-types";

/**
 * 处理场景入口
 */
export function handleScenesIndex(toJSON: ToJSON) {
 return toJSON.scenes.reduce((p, c) => {
   const exportStr = `export { Slot_${c.id} } from "./slot_${c.id}";`;
   return p ? `${p}\n${exportStr}` : exportStr;
 }, "");
}