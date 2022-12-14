/** 不打印io日志 */
let silent = false;
export function setLoggerSilent() {
  silent = true;
}

export function log(msg) {
  if (silent) {
    return;
  }
  console.log(
    `%c[Mybricks]%c ${msg}\n`,
    `color:#FFF;background:#fa6400`,
    ``,
    ``
  );
}

export function logInputVal(comTitle, comDef, pinId, val) {
  if (silent) {
    return;
  }
  let tval;
  try {
    tval = JSON.stringify(val);
  } catch (ex) {
    tval = val;
  }

  console.log(
    `%c[Mybricks] 输入项 %c ${
      comTitle || comDef.title || comDef.namespace
    } | ${pinId} -> ${tval}`,
    `color:#FFF;background:#000`,
    ``,
    ``
  );
}

export function logOutputVal(comTitle, comDef, pinId, val) {
  if (silent) {
    return;
  }
  let tval;
  try {
    tval = JSON.stringify(val);
  } catch (ex) {
    tval = val;
  }

  console.log(
    `%c[Mybricks] 输出项 %c ${
      comTitle || comDef.title || comDef.namespace
    } | ${pinId} -> ${tval}`,
    `color:#FFF;background:#fa6400`,
    ``,
    ``
  );
}
