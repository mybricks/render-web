import { observable } from "./";
import {isObject} from "../utils";
import {
  rawToProxy,
  proxyToRaw,
  globalTaskEmitter,
  globalReactionStack
} from "./global";

function get (target, key) {
  const result = target[key];

  if (["$$typeof", "constructor"].includes(key)) {
    return result;
  }

  globalReactionStack.regist({ target, key });

  const observableResult = rawToProxy.get(result);

  if (isObject(result)) {
    // 如果get的值已经是可观察对象，直接返回
    if (observableResult) {
      return observableResult;
    }

    return observable(result);
  }

  return observableResult || result;
}

function set (target, key, value) {
  // 观察对象和原始对象隔离
  if (isObject(value)) {
    value = proxyToRaw.get(value) || value;
  }

  // 是否已经有这个修改的key
  const hasOwnProperty = Object.hasOwnProperty.call(target, key);
  // 老数据
  const preValue = target[key];

  target[key] = value;

  let runTask = false;

  switch (true) {
    case (!hasOwnProperty || (Array.isArray(target) && key === "length")):
      runTask = true;
      break;
    case value !== preValue:
      runTask = true;
      break;
    default:
      break;
  }

  if (runTask) {
    globalTaskEmitter.runTask({ target, key });
    globalTaskEmitter.deleteTask(rawToProxy.get(preValue));
  }

  return true;
}

export default {
  get,
  set
};
