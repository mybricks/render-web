/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 是 Object 或 Array
 * @param {*} value 任意值
 * @returns {boolean}
 */
export function isObject(value: any): boolean {
  return value && typeof value === "object";
}

/**
 * 是 number
 * @param {*} num 任意值
 * @returns {boolean}
 */
export function isNumber(num: any) {
  return typeof num === "number" && !isNaN(num);
}

export function compareVersion(version1: string, version2: string) {
  const arr1 = version1.split(".");
  const arr2 = version2.split(".");
  const length1 = arr1.length;
  const length2 = arr2.length;
  const minlength = Math.min(length1, length2);
  let i = 0;
  for (i; i < minlength; i++) {
    const a = parseInt(arr1[i]);
    const b = parseInt(arr2[i]);
    if (a > b) {
      return 1;
    } else if (a < b) {
      return -1;
    }
  }
  if (length1 > length2) {
    for (let j = i; j < length1; j++) {
      if (parseInt(arr1[j]) != 0) {
        return 1;
      }
    }
    return 0;
  } else if (length1 < length2) {
    for (let j = i; j < length2; j++) {
      if (parseInt(arr2[j]) != 0) {
        return -1;
      }
    }
    return 0;
  }
  return 0;
}

export function uuid(len = 5, radix = 8) {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
  const uuid = [];
  radix = radix || chars.length;

  if (len) {
    // Compact form
    for (let i = 0; i < len; i++) uuid[i] = chars[0 | (Math.random() * radix)];
  } else {
    // rfc4122, version 4 form
    let r;

    // rfc4122 requires these characters
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
    uuid[14] = "4";

    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
    for (let i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | (Math.random() * 16);
        uuid[i] = chars[i == 19 ? (r & 0x3) | 0x8 : r];
      }
    }
  }

  return uuid.join("");
}

/**
 * 将驼峰式命名的字符串转换为连字符分隔的字符串。
 * @param {string} str - 驼峰式命名的字符串。
 * @returns {string} - 转换为连字符分隔的字符串。
 */
export function convertCamelToHyphen(str: string) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

const toFixed = function toFixed(number: number, precision: number) {
  const multiplier = Math.pow(10, precision + 1);
  const wholeNumber = Math.floor(number * multiplier);
  return (Math.round(wholeNumber / 10) * 10) / multiplier;
};

const createPxReplacer = function createPxReplacer(
  perRatio: number,
  minPixelValue: number,
  unitPrecision: number,
  unit: string,
) {
  return function (origin: string, $1: string) {
    const pixels = parseFloat($1);

    if (!$1 || pixels <= minPixelValue) {
      return origin;
    } else {
      // @ts-ignore
      return "".concat(toFixed(pixels / perRatio, unitPrecision)).concat(unit);
    }
  };
};

const remReplace = createPxReplacer(12, 0, 5, "rem");
const vwReplace = createPxReplacer(3.75, 0, 5, "vw");

const REG_PX = /"[^"]+"|'[^']+'|url\([^)]+\)|(\d*\.?\d+)px/g;

export const pxToRem = (value: string) => {
  return value.replace(REG_PX, remReplace);
};

export const pxToVw = (value: string) => {
  return value.replace(REG_PX, vwReplace);
};

export const getPxToRem = () => {};

export const getPxToVw = ({ viewportWidth = 375, unitPrecision = 5 }) => {
  const vwReplace = createPxReplacer(
    viewportWidth / 100,
    0,
    unitPrecision,
    "vw",
  );
  return (value: string) => {
    return value.replace(REG_PX, vwReplace);
  };
};

export function dataSlim(value: any) {
  return value;
}

/**
 *
 * @returns 获取style样式挂载节点
 */
export function getStylesheetMountNode(): Node {
  return (
    document.getElementById("_mybricks-geo-webview_")?.shadowRoot ||
    document.head
  );
}

export function easyClone(val: any) {
  if (val && typeof val === "object") {
    try {
      if (val instanceof FormData) {
        return val;
      }
      return JSON.parse(JSON.stringify(val));
    } catch (ex) {
      return val;
    }
  }
  return val;
}

export function easyDeepCopy(obj: any, cache: any = []) {
  const type = Object.prototype.toString.call(obj);
  if (!["[object Object]", "[object Array]"].includes(type)) {
    return obj;
  }

  const hit = cache.filter((i: any) => i.original === obj)[0];

  if (hit) {
    return hit.copy;
  }

  const copy: any = Array.isArray(obj) ? [] : {};

  cache.push({
    original: obj,
    copy,
  });

  Object.keys(obj).forEach((key) => {
    copy[key] = easyDeepCopy(obj[key], cache);
  });

  return copy;
}

export function deepCopy(obj: any, cache: any = []) {
  const type = Object.prototype.toString.call(obj);
  if (!["[object Object]", "[object Array]"].includes(type)) {
    return obj;
  }

  const hit = cache.filter((i: any) => i.original === obj)[0];

  if (hit) {
    return hit.copy;
  }

  const copy: any = Array.isArray(obj) ? [] : {};

  cache.push({
    original: obj,
    copy,
  });

  Object.getOwnPropertyNames(obj).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);

    if (descriptor && typeof descriptor.get === "function") {
      Object.defineProperty(copy, key, {
        get: descriptor.get,
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
      });
    } else {
      copy[key] = deepCopy(obj[key], cache);
    }
  });

  return copy;
}

const hasProxy = typeof Proxy !== "undefined";

export const fillProxy = (obj: any, handler: any) => {
  if (hasProxy) {
    return new Proxy(obj, handler);
  } else {
    console.log("环境内没有Proxy");
  }
};

export const getValueByPath = (params: any) => {
  const { value, path } = params;
  let current = value;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

export const setValueByPath = (params: any) => {
  const { data, value, path } = params;
  let current = data;
  const nextIndex = path.length - 1;
  let errorFlag = false;
  for (let i = 0; i < nextIndex; i++) {
    try {
      if (path[i] in current) {
        current = current[path[i]];
      } else {
        current[path[i]] = {};
        current = current[path[i]];
      }
    } catch (error) {
      errorFlag = true;
      console.error(
        "[core - executor] setValueByPath 设置属性失败，请检查绑定路径是否正确",
        params,
        error,
      );
      break;
    }
  }

  if (!errorFlag) {
    current[path[nextIndex]] = value;
  }
};

export const isVariableNamespace = (namespace: string) => {
  return namespace === "mybricks.core-comlib.var";
};

interface DataProxyParams {
  data: any;
  path?: string;
  config: {
    set: (params: { value: any; path: string }) => void;
  };
}
const DATA_PROXY_TAG = Symbol("DATA_PROXY_TAG");
export const CONFIG_SET_VALUE_TAB = Symbol("CONFIG_SET_VALUE_TAB");
export const dataProxy = (params: DataProxyParams) => {
  const { data, path, config } = params;
  const obj: any = {};
  return new Proxy(obj, {
    get(_, key: any) {
      if (key in obj) {
        return data[key];
      }

      const value = data[key];

      if (isObject(value)) {
        return (obj[key] = dataProxy({
          data: value,
          path: path ? `${path}.${key}` : key,
          config,
        }));
      } else {
        return (obj[key] = value);
      }
    },
    set(_, key: any, value) {
      if (value?.[CONFIG_SET_VALUE_TAB]) {
        // 通过config设置值，不需要走set
        // 目前只有组件内赋值和config赋值
        data[key] = value.value;
        obj[key] = value.value;
      } else {
        data[key] = value;
        obj[key] = value;
        config?.set?.({
          value,
          path: path ? `${path}.${key}` : key,
        });
      }
      return true;
    },
  });
};
