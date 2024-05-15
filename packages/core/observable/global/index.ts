export { globalTaskEmitter } from "./taskEmitter";

export { globalReactionStack } from "./reactionStack";

// proxy处理对象 => 获取原始对象
export const proxyToRaw = new WeakMap();

// 获取原始对象 => proxy处理对象
export const rawToProxy = new WeakMap();
