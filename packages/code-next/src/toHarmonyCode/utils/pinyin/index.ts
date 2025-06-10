import * as pinyin from "./core";
import * as patcher56L from "./patchers/56l";

if (pinyin.isSupported() && patcher56L.shouldPatch(pinyin.genToken)) {
  pinyin.patchDict(patcher56L);
}

export { pinyin };
