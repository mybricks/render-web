/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** 不打印io日志 */
let silent = false;
export function setLoggerSilent() {
  silent = true;
}

export function getLogInputVal(
  comTitle: any,
  comDef: any,
  pinId: any,
  val: any,
) {
  let tval;
  try {
    tval = JSON.stringify(val);
  } catch (ex) {
    tval = val;
  }

  return [
    `%c 输入 %c ${
      comTitle || comDef.title || comDef.namespace
    } | ${pinId} -> ${tval}`,
    `color:#FFF;background:#000`,
    ``,
    ``,
  ];
}

export function logInputVal(comTitle: any, comDef: any, pinId: any, val: any) {
  if (silent) {
    return;
  }
  console.log(...getLogInputVal(comTitle, comDef, pinId, val));
}

export function getLogOutVal(comTitle: any, comDef: any, pinId: any, val: any) {
  let tval;
  try {
    tval = JSON.stringify(val);
  } catch (ex) {
    tval = val;
  }

  return [
    `%c 输出 %c ${
      comTitle || comDef.title || comDef.namespace
    } | ${pinId} -> ${tval}`,
    `color:#FFF;background:#fa6400`,
    ``,
    ``,
  ];
}

export function logOutputVal(comTitle: any, comDef: any, pinId: any, val: any) {
  if (silent) {
    return;
  }
  console.log(...getLogOutVal(comTitle, comDef, pinId, val));
}
