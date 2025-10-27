/* eslint-disable @typescript-eslint/no-explicit-any */
import { UNDEFINED } from "../constant";
import { formatValue } from "./index";
import type { ComInfo } from "../../../toCode/types";

interface Params {
  data: ComInfo["model"]["data"];
}
interface Config {
  initialIndent: number;
  indentSize: number;
}

const genCreateVariableFirstParams = (params: Params, config: Config) => {
  const { data } = params;

  let initValue: any = UNDEFINED;

  if ("initValue" in data) {
    // 如果配置默认值，才会有「initValue」字段
    initValue = data.initValue;
  }

  return initValue === UNDEFINED
    ? ""
    : initValue && typeof initValue === "object"
      ? formatValue(initValue, 0, config)
      : JSON.stringify(initValue);
};

export { genCreateVariableFirstParams };
